fn main() {
    // capabilities_path_pattern() を渡すと tauri-build 側が rerun-if-changed を
    // 出さなくなるため、ここで自前に宣言する（無いと capabilities の編集が
    // 再ビルドに反映されず、古い ACL のまま動いてしまう）。
    println!("cargo:rerun-if-changed=capabilities");

    let attributes = tauri_build::Attributes::new();

    // updater は --features updater を付けたリリースビルドのみ有効。プラグインを
    // リンクしない既定ビルドでは capabilities/updater.json をパース対象から外し、
    // 存在しない updater パーミッションの検証エラーを避ける。
    #[cfg(feature = "updater")]
    let attributes = attributes.capabilities_path_pattern("./capabilities/**/*");
    #[cfg(not(feature = "updater"))]
    let attributes = attributes.capabilities_path_pattern("./capabilities/default.json");

    // expect は anyhow を Debug 整形するだけで原因が読みにくいため、
    // エラーチェーンを展開して出す。
    tauri_build::try_build(attributes)
        .unwrap_or_else(|e| panic!("failed to run tauri-build: {e:#}"));
}
