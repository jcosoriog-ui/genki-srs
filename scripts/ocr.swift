import Foundation
import Vision
import AppKit
let args = CommandLine.arguments
let inDir = args[1], outDir = args[2]
let files = try! FileManager.default.contentsOfDirectory(atPath: inDir).filter{$0.hasSuffix(".jpeg")||$0.hasSuffix(".png")||$0.hasSuffix(".jpg")}.sorted()
for f in files {
  let outPath = outDir + "/" + (f as NSString).deletingPathExtension + ".json"
  if FileManager.default.fileExists(atPath: outPath) { continue }
  guard let img = NSImage(contentsOfFile: inDir + "/" + f),
        let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.recognitionLanguages = ["ja-JP", "en-US"]
  req.usesLanguageCorrection = false
  let h = VNImageRequestHandler(cgImage: cg, options: [:])
  try? h.perform([req])
  var arr: [[String: Any]] = []
  for o in req.results ?? [] {
    guard let c = o.topCandidates(1).first else { continue }
    let b = o.boundingBox
    arr.append(["t": c.string, "x": b.minX, "y": 1 - b.maxY, "w": b.width, "h": b.height, "c": c.confidence])
  }
  let data = try! JSONSerialization.data(withJSONObject: arr, options: [])
  try! data.write(to: URL(fileURLWithPath: outPath))
  print(f, arr.count)
}
