#!/usr/bin/env swift

import CoreGraphics
import Foundation
import ImageIO

guard CommandLine.arguments.count == 4 else {
    fputs("Usage: generate-assets.swift <icone-source> <logo-source> <destination>\n", stderr)
    exit(64)
}

let iconSourceURL = URL(fileURLWithPath: CommandLine.arguments[1])
let logoSourceURL = URL(fileURLWithPath: CommandLine.arguments[2])
let catalogURL = URL(fileURLWithPath: CommandLine.arguments[3], isDirectory: true)
let fileManager = FileManager.default

guard let sourceIconProvider = CGImageSourceCreateWithURL(iconSourceURL as CFURL, nil),
      let sourceIcon = CGImageSourceCreateImageAtIndex(sourceIconProvider, 0, nil) else {
    fputs("Icône Maison Pilote illisible.\n", stderr)
    exit(66)
}

try fileManager.createDirectory(at: catalogURL, withIntermediateDirectories: true)
let appIconURL = catalogURL.appendingPathComponent("AppIcon.appiconset", isDirectory: true)
let launchLogoURL = catalogURL.appendingPathComponent("LaunchLogo.imageset", isDirectory: true)
let accentURL = catalogURL.appendingPathComponent("AccentColor.colorset", isDirectory: true)
let launchBackgroundURL = catalogURL.appendingPathComponent("LaunchBackground.colorset", isDirectory: true)
for directory in [appIconURL, launchLogoURL, accentURL, launchBackgroundURL] {
    try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
}

struct IconVariant {
    let filename: String
    let pixels: Int
}

let variants = [
    IconVariant(filename: "icon-20@2x.png", pixels: 40),
    IconVariant(filename: "icon-20@3x.png", pixels: 60),
    IconVariant(filename: "icon-29@2x.png", pixels: 58),
    IconVariant(filename: "icon-29@3x.png", pixels: 87),
    IconVariant(filename: "icon-40@2x.png", pixels: 80),
    IconVariant(filename: "icon-40@3x.png", pixels: 120),
    IconVariant(filename: "icon-60@2x.png", pixels: 120),
    IconVariant(filename: "icon-60@3x.png", pixels: 180),
    IconVariant(filename: "icon-20-ipad.png", pixels: 20),
    IconVariant(filename: "icon-20-ipad@2x.png", pixels: 40),
    IconVariant(filename: "icon-29-ipad.png", pixels: 29),
    IconVariant(filename: "icon-29-ipad@2x.png", pixels: 58),
    IconVariant(filename: "icon-40-ipad.png", pixels: 40),
    IconVariant(filename: "icon-40-ipad@2x.png", pixels: 80),
    IconVariant(filename: "icon-76.png", pixels: 76),
    IconVariant(filename: "icon-76@2x.png", pixels: 152),
    IconVariant(filename: "icon-83.5@2x.png", pixels: 167),
    IconVariant(filename: "icon-1024.png", pixels: 1024),
    IconVariant(filename: "watch-notification-24@2x.png", pixels: 48),
    IconVariant(filename: "watch-notification-27.5@2x.png", pixels: 55),
    IconVariant(filename: "watch-settings-29@2x.png", pixels: 58),
    IconVariant(filename: "watch-settings-29@3x.png", pixels: 87),
    IconVariant(filename: "watch-launcher-40@2x.png", pixels: 80),
    IconVariant(filename: "watch-launcher-44@2x.png", pixels: 88),
    IconVariant(filename: "watch-launcher-50@2x.png", pixels: 100),
    IconVariant(filename: "watch-launcher-51@2x.png", pixels: 102),
    IconVariant(filename: "watch-quicklook-86@2x.png", pixels: 172),
    IconVariant(filename: "watch-quicklook-98@2x.png", pixels: 196),
    IconVariant(filename: "watch-quicklook-108@2x.png", pixels: 216),
    IconVariant(filename: "watch-quicklook-117@2x.png", pixels: 234),
    IconVariant(filename: "watch-marketing-1024.png", pixels: 1024),
]

func renderIcon(_ image: CGImage, pixels: Int, destination: URL) throws {
    let bitmapInfo = CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue)
    guard let context = CGContext(
        data: nil,
        width: pixels,
        height: pixels,
        bitsPerComponent: 8,
        bytesPerRow: pixels * 4,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: bitmapInfo.rawValue
    ) else {
        throw CocoaError(.fileWriteUnknown)
    }

    context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: pixels, height: pixels))
    context.interpolationQuality = .high
    context.draw(image, in: CGRect(x: 0, y: 0, width: pixels, height: pixels))

    guard let renderedImage = context.makeImage(),
          let writer = CGImageDestinationCreateWithURL(
              destination as CFURL,
              "public.png" as CFString,
              1,
              nil
          ) else {
        throw CocoaError(.fileWriteUnknown)
    }
    CGImageDestinationAddImage(writer, renderedImage, nil)
    guard CGImageDestinationFinalize(writer) else {
        throw CocoaError(.fileWriteUnknown)
    }
}

for variant in variants {
    try renderIcon(
        sourceIcon,
        pixels: variant.pixels,
        destination: appIconURL.appendingPathComponent(variant.filename)
    )
}

let appIconContents = #"""
{
  "images" : [
    { "filename" : "icon-20@2x.png", "idiom" : "iphone", "scale" : "2x", "size" : "20x20" },
    { "filename" : "icon-20@3x.png", "idiom" : "iphone", "scale" : "3x", "size" : "20x20" },
    { "filename" : "icon-29@2x.png", "idiom" : "iphone", "scale" : "2x", "size" : "29x29" },
    { "filename" : "icon-29@3x.png", "idiom" : "iphone", "scale" : "3x", "size" : "29x29" },
    { "filename" : "icon-40@2x.png", "idiom" : "iphone", "scale" : "2x", "size" : "40x40" },
    { "filename" : "icon-40@3x.png", "idiom" : "iphone", "scale" : "3x", "size" : "40x40" },
    { "filename" : "icon-60@2x.png", "idiom" : "iphone", "scale" : "2x", "size" : "60x60" },
    { "filename" : "icon-60@3x.png", "idiom" : "iphone", "scale" : "3x", "size" : "60x60" },
    { "filename" : "icon-20-ipad.png", "idiom" : "ipad", "scale" : "1x", "size" : "20x20" },
    { "filename" : "icon-20-ipad@2x.png", "idiom" : "ipad", "scale" : "2x", "size" : "20x20" },
    { "filename" : "icon-29-ipad.png", "idiom" : "ipad", "scale" : "1x", "size" : "29x29" },
    { "filename" : "icon-29-ipad@2x.png", "idiom" : "ipad", "scale" : "2x", "size" : "29x29" },
    { "filename" : "icon-40-ipad.png", "idiom" : "ipad", "scale" : "1x", "size" : "40x40" },
    { "filename" : "icon-40-ipad@2x.png", "idiom" : "ipad", "scale" : "2x", "size" : "40x40" },
    { "filename" : "icon-76.png", "idiom" : "ipad", "scale" : "1x", "size" : "76x76" },
    { "filename" : "icon-76@2x.png", "idiom" : "ipad", "scale" : "2x", "size" : "76x76" },
    { "filename" : "icon-83.5@2x.png", "idiom" : "ipad", "scale" : "2x", "size" : "83.5x83.5" },
    { "filename" : "icon-1024.png", "idiom" : "ios-marketing", "scale" : "1x", "size" : "1024x1024" },
    { "filename" : "watch-notification-24@2x.png", "idiom" : "watch", "role" : "notificationCenter", "scale" : "2x", "size" : "24x24", "subtype" : "38mm" },
    { "filename" : "watch-notification-27.5@2x.png", "idiom" : "watch", "role" : "notificationCenter", "scale" : "2x", "size" : "27.5x27.5", "subtype" : "42mm" },
    { "filename" : "watch-settings-29@2x.png", "idiom" : "watch", "role" : "companionSettings", "scale" : "2x", "size" : "29x29" },
    { "filename" : "watch-settings-29@3x.png", "idiom" : "watch", "role" : "companionSettings", "scale" : "3x", "size" : "29x29" },
    { "filename" : "watch-launcher-40@2x.png", "idiom" : "watch", "role" : "appLauncher", "scale" : "2x", "size" : "40x40", "subtype" : "38mm" },
    { "filename" : "watch-launcher-44@2x.png", "idiom" : "watch", "role" : "appLauncher", "scale" : "2x", "size" : "44x44", "subtype" : "40mm" },
    { "filename" : "watch-launcher-50@2x.png", "idiom" : "watch", "role" : "appLauncher", "scale" : "2x", "size" : "50x50", "subtype" : "44mm" },
    { "filename" : "watch-launcher-51@2x.png", "idiom" : "watch", "role" : "appLauncher", "scale" : "2x", "size" : "51x51", "subtype" : "45mm" },
    { "filename" : "watch-quicklook-86@2x.png", "idiom" : "watch", "role" : "quickLook", "scale" : "2x", "size" : "86x86", "subtype" : "38mm" },
    { "filename" : "watch-quicklook-98@2x.png", "idiom" : "watch", "role" : "quickLook", "scale" : "2x", "size" : "98x98", "subtype" : "42mm" },
    { "filename" : "watch-quicklook-108@2x.png", "idiom" : "watch", "role" : "quickLook", "scale" : "2x", "size" : "108x108", "subtype" : "44mm" },
    { "filename" : "watch-quicklook-117@2x.png", "idiom" : "watch", "role" : "quickLook", "scale" : "2x", "size" : "117x117", "subtype" : "45mm" },
    { "filename" : "watch-marketing-1024.png", "idiom" : "watch-marketing", "scale" : "1x", "size" : "1024x1024" }
  ],
  "info" : { "author" : "xcode", "version" : 1 }
}
"""#
try appIconContents.data(using: .utf8)!.write(
    to: appIconURL.appendingPathComponent("Contents.json"),
    options: .atomic
)

let launchLogoName = "logo-couleur.png"
let launchLogoTarget = launchLogoURL.appendingPathComponent(launchLogoName)
try? fileManager.removeItem(at: launchLogoTarget)
try fileManager.copyItem(at: logoSourceURL, to: launchLogoTarget)
let launchLogoContents = #"""
{
  "images" : [
    { "filename" : "logo-couleur.png", "idiom" : "universal", "scale" : "1x" },
    { "idiom" : "universal", "scale" : "2x" },
    { "idiom" : "universal", "scale" : "3x" }
  ],
  "info" : { "author" : "xcode", "version" : 1 }
}
"""#
try launchLogoContents.data(using: .utf8)!.write(
    to: launchLogoURL.appendingPathComponent("Contents.json"),
    options: .atomic
)

let accentContents = #"""
{
  "colors" : [
    { "color" : { "color-space" : "srgb", "components" : { "alpha" : "1.000", "blue" : "0.439", "green" : "0.369", "red" : "0.192" } }, "idiom" : "universal" }
  ],
  "info" : { "author" : "xcode", "version" : 1 }
}
"""#
try accentContents.data(using: .utf8)!.write(
    to: accentURL.appendingPathComponent("Contents.json"),
    options: .atomic
)

let backgroundContents = #"""
{
  "colors" : [
    { "color" : { "color-space" : "srgb", "components" : { "alpha" : "1.000", "blue" : "1.000", "green" : "1.000", "red" : "1.000" } }, "idiom" : "universal" }
  ],
  "info" : { "author" : "xcode", "version" : 1 }
}
"""#
try backgroundContents.data(using: .utf8)!.write(
    to: launchBackgroundURL.appendingPathComponent("Contents.json"),
    options: .atomic
)

let catalogContents = #"""
{ "info" : { "author" : "xcode", "version" : 1 } }
"""#
try catalogContents.data(using: .utf8)!.write(
    to: catalogURL.appendingPathComponent("Contents.json"),
    options: .atomic
)

print("Assets iOS et watchOS générés depuis les sources Maison Pilote existantes.")
