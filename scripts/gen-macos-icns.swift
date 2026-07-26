// macOS のアイコングリッド規格に合わせた icon.icns を生成する。
//
// tauri icon はソース画像を単純にリサイズするだけなので、フチなしの正方形を渡すと
// Dock でタイル全面を占めてしまい、他アプリより一段大きく見える。
// Apple の macOS アイコングリッドでは 1024 キャンバスに対して本体が 824x824
// （上下左右 100px の余白）、角丸半径 185.4px（824 * 0.225）が標準。
//
// 角丸は CALayer の cornerCurve = .continuous を使い、OS 本来の連続曲率
// （squircle）をそのまま描画させている。circular arc の近似ではない。
//
// 使い方: swift scripts/gen-macos-icns.swift <source.png> <out.icns>

import AppKit
import QuartzCore

// Apple の macOS アイコングリッド（1024 キャンバス基準の比率）
let bodyRatio = 824.0 / 1024.0
let radiusRatio = 185.4 / 1024.0

// .icns に含める (ファイル名, ピクセルサイズ)
let variants: [(String, Int)] = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024),
]

func fail(_ message: String) -> Never {
    FileHandle.standardError.write("error: \(message)\n".data(using: .utf8)!)
    exit(1)
}

let args = CommandLine.arguments
guard args.count == 3 else {
    fail("usage: swift \(args.first ?? "gen-macos-icns.swift") <source.png> <out.icns>")
}
let sourcePath = args[1]
let outputPath = args[2]

// ソース画像を読み込む
guard let imageSource = CGImageSourceCreateWithURL(URL(fileURLWithPath: sourcePath) as CFURL, nil),
      let sourceImage = CGImageSourceCreateImageAtIndex(imageSource, 0, nil)
else {
    fail("ソース画像を読み込めなかった: \(sourcePath)")
}
guard sourceImage.width == sourceImage.height else {
    fail("ソース画像は正方形である必要がある（実際: \(sourceImage.width)x\(sourceImage.height)）")
}

/// 指定サイズのキャンバスに、余白付き・角丸の本体を描いた PNG を返す。
func renderIcon(size: Int) -> Data {
    let canvas = CGFloat(size)
    let body = (canvas * bodyRatio).rounded()
    let inset = ((canvas - body) / 2).rounded()

    guard let context = CGContext(
        data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpace(name: CGColorSpace.sRGB)!,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
        fail("CGContext を作れなかった (size=\(size))")
    }

    let bodyLayer = CALayer()
    bodyLayer.frame = CGRect(x: inset, y: inset, width: body, height: body)
    bodyLayer.contents = sourceImage
    bodyLayer.contentsGravity = .resizeAspectFill
    bodyLayer.minificationFilter = .trilinear
    bodyLayer.magnificationFilter = .trilinear
    bodyLayer.cornerRadius = canvas * radiusRatio
    bodyLayer.cornerCurve = .continuous
    bodyLayer.masksToBounds = true

    let root = CALayer()
    root.frame = CGRect(x: 0, y: 0, width: canvas, height: canvas)
    root.addSublayer(bodyLayer)
    root.render(in: context)

    guard let cgImage = context.makeImage() else { fail("ビットマップ化に失敗 (size=\(size))") }
    let rep = NSBitmapImageRep(cgImage: cgImage)
    rep.size = NSSize(width: canvas, height: canvas)
    guard let png = rep.representation(using: .png, properties: [:]) else {
        fail("PNG エンコードに失敗 (size=\(size))")
    }
    return png
}

// .iconset を組み立てて iconutil で .icns にする
let fm = FileManager.default
let iconset = URL(fileURLWithPath: fm.temporaryDirectory.path)
    .appendingPathComponent("lite-markdown-\(ProcessInfo.processInfo.processIdentifier).iconset")
try? fm.removeItem(at: iconset)
try! fm.createDirectory(at: iconset, withIntermediateDirectories: true)
defer { try? fm.removeItem(at: iconset) }

// 同じピクセルサイズは 1 回だけ描いて使い回す
var cache: [Int: Data] = [:]
for (name, size) in variants {
    let png = cache[size] ?? renderIcon(size: size)
    cache[size] = png
    try! png.write(to: iconset.appendingPathComponent(name))
}

let iconutil = Process()
iconutil.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
iconutil.arguments = ["-c", "icns", iconset.path, "-o", outputPath]
try! iconutil.run()
iconutil.waitUntilExit()
guard iconutil.terminationStatus == 0 else { fail("iconutil が失敗した") }

print("生成: \(outputPath)")
