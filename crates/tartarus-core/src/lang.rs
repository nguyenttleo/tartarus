use std::path::{Path, PathBuf};

use crate::types::Language;

pub const GUEST_SOURCE_DIR: &str = "/sandbox";
pub const GUEST_TMP_DIR: &str = "/tmp";

pub struct LangRuntime {
    pub wasm_file: &'static str,
    pub source_file: &'static str,
    pub argv0: &'static str,
}

impl Language {
    pub fn runtime(self) -> LangRuntime {
        match self {
            Language::Python => LangRuntime {
                wasm_file: "python.wasm",
                source_file: "main.py",
                argv0: "python",
            },
            Language::Javascript => LangRuntime {
                wasm_file: "qjs.wasm",
                source_file: "main.js",
                argv0: "qjs",
            },
        }
    }

    pub fn wasm_path(self, runtimes_dir: &Path) -> PathBuf {
        runtimes_dir.join(self.runtime().wasm_file)
    }

    pub fn guest_source_path(self) -> String {
        format!("{GUEST_SOURCE_DIR}/{}", self.runtime().source_file)
    }

    pub fn argv(self) -> Vec<String> {
        let rt = self.runtime();
        vec![rt.argv0.to_string(), self.guest_source_path()]
    }
}
