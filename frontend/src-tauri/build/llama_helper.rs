use std::path::{Path, PathBuf};
use std::process::Command;

pub fn ensure_llama_helper_binary() {
    let target = std::env::var("TARGET")
        .or_else(|_| std::env::var("HOST"))
        .expect("Neither TARGET nor HOST environment variable set");

    println!(
        "cargo:warning=🦙 Ensuring llama-helper sidecar exists for target: {}",
        target
    );

    let manifest_dir = PathBuf::from(
        std::env::var("CARGO_MANIFEST_DIR")
            .expect("CARGO_MANIFEST_DIR environment variable not set"),
    );
    let repo_root = manifest_dir
        .join("../..")
        .canonicalize()
        .expect("Failed to resolve repo root");
    let helper_manifest = repo_root.join("llama-helper/Cargo.toml");

    if !helper_manifest.exists() {
        panic!(
            "llama-helper manifest not found at {}",
            helper_manifest.display()
        );
    }

    let binaries_dir = manifest_dir.join("binaries");
    if !binaries_dir.exists() {
        std::fs::create_dir_all(&binaries_dir).expect("Failed to create binaries directory");
    }

    let sidecar_filename = target_sidecar_filename(&target);
    let sidecar_path = binaries_dir.join(&sidecar_filename);

    let helper_target_dir = repo_root.join("target/llama-helper-sidecar");
    let profile = std::env::var("PROFILE").unwrap_or_else(|_| String::from("debug"));
    let helper_binary_path =
        helper_target_dir.join(&target).join(&profile).join(helper_output_name(&target));

    build_llama_helper(&repo_root, &helper_manifest, &helper_target_dir, &target, &profile);

    if !helper_binary_path.exists() {
        panic!(
            "llama-helper build completed but expected binary was not found at {}",
            helper_binary_path.display()
        );
    }

    std::fs::copy(&helper_binary_path, &sidecar_path).unwrap_or_else(|e| {
        panic!(
            "Failed to copy llama-helper sidecar from {} to {}: {}",
            helper_binary_path.display(),
            sidecar_path.display(),
            e
        )
    });

    #[cfg(unix)]
    set_executable_permissions(&sidecar_path);

    println!(
        "cargo:warning=✅ llama-helper sidecar ready at {}",
        sidecar_path.display()
    );

    emit_rerun_directives(&repo_root.join("llama-helper"));
}

fn build_llama_helper(
    repo_root: &Path,
    helper_manifest: &Path,
    helper_target_dir: &Path,
    target: &str,
    profile: &str,
) {
    let mut command = Command::new("cargo");
    command
        .current_dir(repo_root)
        .arg("build")
        .arg("--manifest-path")
        .arg(helper_manifest)
        .arg("--target")
        .arg(target)
        .arg("--target-dir")
        .arg(helper_target_dir);

    if profile == "release" {
        command.arg("--release");
    }

    let status = command.status().unwrap_or_else(|e| {
        panic!(
            "Failed to invoke cargo to build llama-helper for target {}: {}",
            target, e
        )
    });

    if !status.success() {
        panic!(
            "cargo build for llama-helper failed with status {} while targeting {}",
            status, target
        );
    }
}

fn helper_output_name(target: &str) -> String {
    if target.contains("windows") {
        String::from("llama-helper.exe")
    } else {
        String::from("llama-helper")
    }
}

fn target_sidecar_filename(target: &str) -> String {
    if target.contains("windows") {
        format!("llama-helper-{}.exe", target)
    } else {
        format!("llama-helper-{}", target)
    }
}

fn emit_rerun_directives(helper_dir: &Path) {
    println!("cargo:rerun-if-env-changed=TARGET");
    println!("cargo:rerun-if-env-changed=HOST");
    println!("cargo:rerun-if-env-changed=PROFILE");

    emit_dir_rerun_if_changed(helper_dir);
}

fn emit_dir_rerun_if_changed(dir: &Path) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                emit_dir_rerun_if_changed(&path);
            } else if path.is_file() {
                println!("cargo:rerun-if-changed={}", path.display());
            }
        }
    }
}

#[cfg(unix)]
fn set_executable_permissions(path: &Path) {
    use std::os::unix::fs::PermissionsExt;

    let mut perms = std::fs::metadata(path)
        .unwrap_or_else(|e| panic!("Failed to read metadata for {}: {}", path.display(), e))
        .permissions();
    perms.set_mode(0o755);
    std::fs::set_permissions(path, perms).unwrap_or_else(|e| {
        panic!(
            "Failed to set executable permissions on {}: {}",
            path.display(),
            e
        )
    });
}
