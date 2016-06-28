extern crate centralgithook;
extern crate git2;
extern crate tempdir;

use centralgithook::migrate;
use std::path::{Path, PathBuf};
use tempdir::TempDir;
use centralgithook::migrate::RepoHost;

pub struct TestHost
{
    td: TempDir,
}

impl TestHost
{
    pub fn new() -> Self
    {
        TestHost { td: TempDir::new("test_host").expect("folder test_host should be created") }
    }

    pub fn repo_dir(&self, module: &str) -> PathBuf
    {
        self.td.path().join(module).with_extension("git")
    }

    pub fn create_project(&self, module: &str) -> String
    {
        println!("TestHost: create_project {} in {:?}",
                 module,
                 self.repo_dir(module));
        git2::Repository::init_bare(&self.repo_dir(module)).expect("TestHost: init_bare failed");
        return String::new();
    }
}

#[test]
fn test_test_host()
{
    let host = TestHost::new();
    assert_eq!(0, host.projects().len());

    host.create_project("module_a");
    let mut projects = host.projects();
    projects.sort();
    assert_eq!(vec!["module_a"], projects);

    host.create_project("modules/module_b");
    let mut projects = host.projects();
    projects.sort();
    assert_eq!(2, projects.len());
    assert_eq!(vec!["module_a", "modules/module_b"], projects);
}


impl migrate::RepoHost for TestHost
{

    fn remote_url(&self, module_path: &str) -> String
    {
        self.td.path().join(&module_path).with_extension("git").to_string_lossy().to_string()
    }

    fn projects(&self) -> Vec<String>
    {
        migrate::find_repos(self.td.path(), self.td.path(), vec![])
    }

    fn central(&self) -> &str { "central" }
}

pub struct TestRepo
{
    pub repo: git2::Repository,
    pub path: PathBuf,
    pub shell: migrate::Shell,
}

impl TestRepo
{
    pub fn new(path: &Path) -> Self
    {
        let tr = TestRepo {
            repo: git2::Repository::init(path).expect("init should succeed"),
            path: path.to_path_buf(),
            shell: migrate::Shell { cwd: path.to_path_buf() },
        };
        tr.shell.command("git config user.name test");
        tr.shell.command("git config user.email test@test.com");
        return tr;
    }

    pub fn commit(&self, message: &str) -> String
    {
        self.shell.command(&format!("git commit -m \"{}\"", message));
        self.shell.command("git rev-parse HEAD")
    }

    pub fn add_file(&self, filename: &str)
    {
        self.shell.command(&format!("mkdir -p $(dirname {})", filename));
        self.shell.command(&format!("echo test_content > {}", filename));
        self.shell.command(&format!("git add {}", filename));
    }

    pub fn has_file(&self, filename: &str) -> bool
    {
        self.path.join(Path::new(filename)).exists()
    }

    pub fn rev(&self, r: &str) -> String
    {
        self.shell.command(&format!("git rev-parse {}", r))
    }
}
