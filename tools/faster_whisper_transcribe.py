import argparse
import json
import sys

import torchaudio
from faster_whisper import WhisperModel

try:
    from pyannote.audio import Pipeline
except Exception:
    Pipeline = None


def load_waveform(path):
    waveform, sample_rate = torchaudio.load(path)
    return {
        "waveform": waveform,
        "sample_rate": sample_rate,
    }


def annotation_to_turns(annotation):
    turns = []
    if annotation is None:
        return turns

    for segment, _, label in annotation.itertracks(yield_label=True):
        turns.append({
            "start": float(segment.start),
            "end": float(segment.end),
            "speaker": str(label),
        })
    return turns


def overlap_duration(start_a, end_a, start_b, end_b):
    return max(0.0, min(end_a, end_b) - max(start_a, start_b))


def assign_speakers(segments, speaker_turns):
    if not speaker_turns:
        return segments

    for segment in segments:
        best_speaker = None
        best_overlap = 0.0
        midpoint = (segment["start"] + segment["end"]) / 2.0

        for turn in speaker_turns:
            overlap = overlap_duration(segment["start"], segment["end"], turn["start"], turn["end"])
            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = turn["speaker"]
            elif best_speaker is None and turn["start"] <= midpoint <= turn["end"]:
                best_speaker = turn["speaker"]

        if best_speaker:
            segment["speaker"] = best_speaker

    return segments


def main():
    parser = argparse.ArgumentParser(description="Transcribe media with faster-whisper.")
    parser.add_argument("input_path", help="Path to the local audio/video file")
    parser.add_argument("--model", default="base", help="faster-whisper model name")
    parser.add_argument("--device", default="cpu", help="Inference device")
    parser.add_argument("--compute-type", default="int8", dest="compute_type", help="Inference compute type")
    parser.add_argument("--language", default=None, help="Optional language code")
    parser.add_argument("--hf-token", default=None, help="Hugging Face token for pyannote diarization")
    parser.add_argument("--diarization-model", default="pyannote/speaker-diarization-community-1", help="Pyannote diarization model id")
    args = parser.parse_args()

    model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)
    whisper_segments, info = model.transcribe(
        args.input_path,
        language=args.language,
        vad_filter=True,
        beam_size=5
    )

    serialized_segments = []
    transcript_parts = []

    for segment in whisper_segments:
        text = (segment.text or "").strip()
        if not text:
            continue

        transcript_parts.append(text)
        serialized_segments.append({
            "start": round(float(segment.start), 2),
            "end": round(float(segment.end), 2),
            "text": text,
            "speaker": None,
        })

    diarization_applied = False
    warnings = []
    if args.hf_token and Pipeline is None:
        warnings.append("Pyannote diarization was requested, but pyannote.audio is not installed.")
    elif args.hf_token:
        try:
            audio = load_waveform(args.input_path)
            pipeline = Pipeline.from_pretrained(args.diarization_model, token=args.hf_token)
            diarization_result = pipeline(audio)
            exclusive = getattr(diarization_result, "exclusive_speaker_diarization", None)
            speaker_turns = annotation_to_turns(exclusive or getattr(diarization_result, "speaker_diarization", diarization_result))
            serialized_segments = assign_speakers(serialized_segments, speaker_turns)
            diarization_applied = any(segment.get("speaker") for segment in serialized_segments)
            if not diarization_applied:
                warnings.append("Pyannote ran but did not produce speaker labels for this file.")
        except Exception as exc:
            warnings.append(f"Pyannote diarization failed: {str(exc)}")
    else:
        warnings.append("Hugging Face token not provided, so diarization was skipped.")

    payload = {
        "model": args.model,
        "language": getattr(info, "language", None),
        "duration": getattr(info, "duration", None),
        "diarization_applied": diarization_applied,
        "text": " ".join(transcript_parts).strip(),
        "segments": serialized_segments,
        "warnings": warnings,
    }
    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
