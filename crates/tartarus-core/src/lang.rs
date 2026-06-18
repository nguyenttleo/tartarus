//! Maps a `Language` to the pinned WASI interpreter module that executes it, plus the argv used to
//! point that interpreter at the user's source file inside the sandbox.
//!
//! Each interpreter is a `wasi_snapshot_preview1` command module (exports `_start`) that reads a
//! script path from argv and runs it. The user's source is written to `<sandbox>/main.<ext>` and
//! the sandbox dir is preopened read-only as `/sandbox`, so argv is e.g. `["python", "/sandbox/main.py"]`.
//!
//! If you swap in a different interpreter build whose CLI differs, this is the only place to change.

use std::path::{Path, PathBuf};

use crate::types::Language;

/// The in-sandbox path the user's source is written to and handed to the interpreter.
pub const GUEST_SOURCE_DIR: &str = "/sandbox";
pub const GUEST_TMP_DIR: &str = "/tmp";

pub struct LangRuntime {
    /// Filename of the interpreter wasm inside the runtimes directory.
    pub wasm_file: &'static str,
    /// Source filename written into the sandbox dir.
    pub source_file: &'static str,
    /// argv[0] reported to the guest.
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

    /// Absolute host path to this language's interpreter wasm, under `runtimes_dir`.
    pub fn wasm_path(self, runtimes_dir: &Path) -> PathBuf {
        runtimes_dir.join(self.runtime().wasm_file)
    }

    /// The guest-visible path of the user's source file.
    pub fn guest_source_path(self) -> String {
        format!("{GUEST_SOURCE_DIR}/{}", self.runtime().source_file)
    }

    /// argv handed to the interpreter: `[argv0, "/sandbox/main.ext"]`.
    pub fn argv(self) -> Vec<String> {
        let rt = self.runtime();
        vec![rt.argv0.to_string(), self.guest_source_path()]
    }
}
