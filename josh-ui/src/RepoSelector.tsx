import React from 'react';
import {match, select, when} from 'ts-pattern';
import {None, Option} from 'tsoption';
import {getServer} from './Server';
import {NavigateCallback, NavigateTargetType} from "./Navigation";

type Remote =
    | { type: 'None' }
    | { type: 'Some';  value: string }
    | { type: 'Error'; error: Error }

type UrlCheckResult =
    | { type: 'RemoteMismatch'; }
    | { type: 'ProtocolNotSupported'; }
    | { type: 'NotAGitRepo'; }
    | { type: 'RemoteFound'; path: string }

function checkUrl(url: string, expectedPath: string): UrlCheckResult {
    let trimSuffix = (repo: string) => {
        return repo.replace(/\.git$/, '')
    }
    return match(url)
        .with(when((v: string) => v.startsWith('git@')),
            () => ({ type: 'ProtocolNotSupported' } as UrlCheckResult))
        .with(when((v: string) => v.startsWith(expectedPath)),
            (v) => ({ type: 'RemoteFound', path: trimSuffix(v.replace(expectedPath, '')) } as UrlCheckResult))
        .with(when((v: string) => !(v.startsWith('http://') || v.startsWith('https://'))),
            (v) => ({ type: 'RemoteFound', path: trimSuffix(v) }) as UrlCheckResult)
        .otherwise(() => ({ type: 'RemoteMismatch' } as UrlCheckResult))
}

type RepoSelectorProps = {
    navigateCallback: NavigateCallback
}

type State = {
    remote: Remote
    hint: Option<string>
    repo: Option<string>
    filter: Option<string>
    label: boolean,
}

export class RepoSelector extends React.Component<RepoSelectorProps, State> {
    state: State = {
        remote: { type: 'None' },
        hint: new None(),
        repo: new None(),
        filter: new None(),
        label: true,
    };

    componentDidMount () {
        fetch(getServer() + '/remote')
            .then(response => response.text())
            .then(response => this.setState({
                remote: { type: 'Some', value: response },
            }))
            .catch(error => this.setState({
                remote: { type: 'Error', error: new Error(error) },
            }))
    }

    getStatus = () => {
        return match(this.state.remote)
            .with({ type: 'None' }, () => 'loading...' )
            .with({ type: 'Error', error: select() }, (e) => `error: ${e.message}` )
            .with({ type: 'Some', value: select() }, (v) => `${v}/` )
            .exhaustive()
    }

    getHint = () => {
        return this.state.hint.isEmpty() ? false : <div className={'repo-selector-hint'}>
            {this.state.hint.getOrElse('')}
        </div>
    }

    formatHint = (repo: string): string => {
        const filter = this.state.filter.isEmpty() ? '' : this.state.filter.getOrElse('') + '.git'
        return `Checkout URL: ${getServer()}/${repo}.git${filter}`
    }


    filterChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
        const filter = e.target.value === '' ? new None<string>() : Option.of(e.target.value)
        this.setState({
            filter: filter,
        })
    }

    repoChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
        const getHint = (expectedPath: string) => {
            const checkResult = checkUrl(e.target.value, expectedPath)
            const hint = match(checkResult)
                .with({ type: 'ProtocolNotSupported' },
                    () => Option.of('Only HTTPS access is currently supported'))
                .with({ type: 'NotAGitRepo' },
                    () => Option.of('Repository URL should end in .git'))
                .with({ type: 'RemoteFound', path: select() },
                    (path) => Option.of(this.formatHint(path)))
                .otherwise(() => Option.of('Repository is not located on the current remote'))

            const repo = match(checkResult)
                .with({ type: 'RemoteFound', path: select() },
                    (path) => Option.of(path))
                    .otherwise(() => new None<string>())

            return [hint, repo]
        }

        match(this.state.remote)
            .with({ type: 'Some', value: select() }, (remote) => {
                if (e.target.value === '') {
                    return
                }

                const expectedPath = remote + '/'
                const [hint, repo] = getHint(expectedPath)
                const label = !e.target.value.startsWith(remote)

                this.setState({
                    hint: hint,
                    repo: repo,
                    label: label,
                })
            })
            .with({ type: 'None' }, () => {
                this.setState({
                    repo: new None(),
                    label: true,
                })
            })
            .run()
    }

    buttonPressed = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (this.state.repo.isEmpty()) {
            return
        }

        this.props.navigateCallback(NavigateTargetType.Directory, {
            repo:   this.state.repo.getOrElse('') + '.git',
            path:   '',
            filter: this.state.filter.getOrElse(':/'),
            rev:    'HEAD',
        })
    }

    render() {
        return <div>
            <h3>Select repo</h3>
            <div className={'repo-selector-repo'}>
                { this.state.label &&
                    <span className={'repo-selector-status-label'}>
                        {this.getStatus()}
                    </span>
                }
                <input
                    type={'text'}
                    className={'repo-selector-repo-input ui-input'}
                    placeholder={'repo.git'}
                    onChange={this.repoChanged}
                />
            </div>
            <div className={'repo-selector-filter'}>
                <input
                    type={'text'}
                    className={'repo-selector-filter-input ui-input'}
                    placeholder={':filter'}
                    onChange={this.filterChanged}
                />
            </div>
            {this.getHint()}
            <button onClick={this.buttonPressed} className={'ui-button repo-selector-button'}>
                Browse
            </button>
        </div>
    }
}
