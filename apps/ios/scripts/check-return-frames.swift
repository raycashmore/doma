#!/usr/bin/env swift
// Reads a recording that leaves an open sheet and returns to it, and fails if the sheet's marker
// text is readable while the app is coming back, or if the screen flashes black.
// Usage: check-return-frames.swift <recording> <marker text>
import AVFoundation
import CoreImage
import Vision

let arguments = CommandLine.arguments
guard arguments.count == 3 else {
  print("Usage: check-return-frames.swift <recording> <marker text>")
  exit(2)
}
let marker = arguments[2].lowercased()

/// Faint text on a pale cover is the leak to catch. This gamma reads it on leaky frames where plain
/// frames and a contrast filter do not, and reads nothing on a clean cover.
let context = CIContext()
func recognizedText(in image: CIImage) -> String {
  let boosted = image.applyingFilter("CIGammaAdjust", parameters: ["inputPower": 12.0])
  guard let frame = context.createCGImage(boosted, from: boosted.extent) else { return "" }
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = false
  try? VNImageRequestHandler(cgImage: frame).perform([request])
  return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string.lowercased() }.joined(separator: "\n")
}

/// Mean brightness of the middle of a frame, because the recording's corners are always black.
func centreBrightness(of image: CIImage) -> Double {
  let extent = image.extent.insetBy(dx: image.extent.width * 0.2, dy: image.extent.height * 0.2)
  let average = image.applyingFilter("CIAreaAverage", parameters: [kCIInputExtentKey: CIVector(cgRect: extent)])
  var pixel = [UInt8](repeating: 0, count: 4)
  context.render(average, toBitmap: &pixel, rowBytes: 4, bounds: CGRect(x: 0, y: 0, width: 1, height: 1), format: .RGBA8, colorSpace: nil)
  return (Double(pixel[0]) + Double(pixel[1]) + Double(pixel[2])) / (3 * 255)
}

let asset = AVURLAsset(url: URL(fileURLWithPath: arguments[1]))
let loaded = DispatchSemaphore(value: 0)
nonisolated(unsafe) var videoTrack: AVAssetTrack?
Task {
  videoTrack = try? await asset.loadTracks(withMediaType: .video).first
  loaded.signal()
}
loaded.wait()
guard let videoTrack, let reader = try? AVAssetReader(asset: asset) else {
  print("Could not read \(arguments[1])")
  exit(2)
}
let output = AVAssetReaderTrackOutput(track: videoTrack, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
reader.add(output)
reader.startReading()

var sightings: [(time: Double, isReadable: Bool)] = []
var blackFrames: [Double] = []
while let sample = output.copyNextSampleBuffer() {
  guard let buffer = CMSampleBufferGetImageBuffer(sample) else { continue }
  let image = CIImage(cvPixelBuffer: buffer)
  let time = CMSampleBufferGetPresentationTimeStamp(sample).seconds
  if centreBrightness(of: image) < 0.1 { blackFrames.append(time) }
  sightings.append((time, recognizedText(in: image).contains(marker)))
}

// The marker flickers in and out while the sheet leaves, and is on screen for good after the
// return. The longest stretch without it is the time away, so anything between that and the final
// run of sightings is the app showing through while it was meant to be covered.
var runs: [(start: Double, end: Double)] = []
var wasReadable = false
for sighting in sightings {
  if sighting.isReadable {
    if wasReadable { runs[runs.count - 1].end = sighting.time } else { runs.append((sighting.time, sighting.time)) }
  }
  wasReadable = sighting.isReadable
}

print("\(sightings.count) frames read, marker visible in \(runs.count) run(s), \(blackFrames.count) black frame(s)")
var failed = false
if runs.count < 2 {
  print("Inconclusive: the marker was not seen both leaving and returning.")
  failed = true
} else {
  let gaps = zip(runs, runs.dropFirst()).map { $1.start - $0.end }
  let timeAway = gaps.indices.max { gaps[$0] < gaps[$1] } ?? 0
  for run in runs[(timeAway + 1)...].dropLast() {
    print(String(format: "LEAK: marker readable at %.2f-%.2fs", run.start, run.end))
    failed = true
  }
}
if let first = blackFrames.first {
  print(String(format: "BLACK: screen went black at %.2fs", first))
  failed = true
}
exit(failed ? 1 : 0)
