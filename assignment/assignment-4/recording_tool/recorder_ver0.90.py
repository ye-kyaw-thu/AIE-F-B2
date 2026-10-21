## Written by Ye Kyaw Thu, LU Lab., Myanmar
## for ASR/TTS recording
## Version 0.9
## Last updated: 28 Aug 2026
## 
## How to run: 
## python recorder.py -p isolated.txt -m ordered
## python recorder.py -p chapter1.txt -d audiobook -m sequential -c 50
## python recorder.py -p spoken.txt -m random -sr 16000 -b 16
## python recorder.py --help
##
## Prompt Selection Modes (-m):
##   ordered     : Goes through all prompts top-to-bottom. Stops at the end. (Ignores -c count limit)
##   sequential  : Takes the first N prompts (-c count) and loops them infinitely.
##   random      : Randomly selects N prompts (-c count) from the file.

import os
import random
import sys
import argparse
import sounddevice as sd
import numpy as np
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QVBoxLayout, QPushButton,
    QLabel, QWidget, QListWidget, QMessageBox, QFileDialog, QInputDialog
)
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QKeySequence, QFontDatabase, QFont, QAction
import wave
import csv
from datetime import datetime

class SpeechRecorder(QMainWindow):
    def __init__(self, args):
        super().__init__()
        self.args = args
        
        # 1. Prompt for Speaker Name at startup
        speaker_name, ok = QInputDialog.getText(self, "Speaker Information", "Enter Speaker Name (no spaces):")
        if not ok or not speaker_name.strip():
            QMessageBox.critical(self, "Error", "Speaker name is required!")
            sys.exit(1)
        # Sanitize speaker name for filename usage
        self.speaker_name = speaker_name.strip().replace(" ", "_")
        
        # Auto-generate output directory if not specified
        if not args.save_dir or args.save_dir == "../audio_data":
            timestamp = datetime.now().strftime("%H%M_%d%b%Y")  # e.g., "1439_14Jun2025"
            self.args.save_dir = f"rec_{timestamp}"
        
        self.setWindowTitle(f"Speech Training Recorder - {self.speaker_name} (LU Lab., Myanmar)")
        self.setGeometry(100, 100, 800, 600)
        
        # Audio settings
        self.sample_rate = args.sample_rate
        self.bit_depth = args.bit_depth
        self.channels = 1
        self.dtype = np.int16 if self.bit_depth == 16 else np.int32
        self.audio_buffer = []
        self.is_recording = False
        self.current_output_file = None
        self.unsaved_audio = False  # Track if current buffer is unsaved
        
        # Initialize Myanmar font
        self.init_font()
        self.init_ui()
        self.init_shortcuts()
        
        # Load prompts if provided
        if args.prompts_filename:
            self.load_prompts_from_file(args.prompts_filename)
            if args.prompt_selection == "ordered":
                self.current_prompt_index = 0
            elif args.prompt_selection == "random":
                self.prompts = random.sample(self.prompts, min(len(self.prompts), args.prompts_count))
            elif args.prompt_selection == "sequential":
                self.prompts = self.prompts[:args.prompts_count]

    def init_font(self):
        """Initialize font with Myanmar support"""
        myanmar_fonts = [
            "Pyidaungsu",
            "Myanmar3",  
            "Padauk",
            "Myanmar Text",
            "Noto Sans Myanmar"
        ]
        
        available_fonts = QFontDatabase.families()
        for font in myanmar_fonts:
            if font in available_fonts:
                self.app_font = QFont(font, 14)
                break
        else:
            self.app_font = QFont()
            self.app_font.setPointSize(14)
        
        QApplication.setFont(self.app_font)

    def init_ui(self):
        self.central_widget = QWidget()
        self.setCentralWidget(self.central_widget)
        self.layout = QVBoxLayout()
        
        # Prompt Display
        self.prompt_label = QLabel("Press 'Start Recording' to begin")
        self.prompt_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.prompt_label.setStyleSheet("font-size: 18px; margin: 20px;")
        self.prompt_label.setFont(self.app_font)
        
        # Buttons
        self.record_button = QPushButton("Start Recording (Space)")
        self.play_button = QPushButton("Play Last (P)")
        self.save_button = QPushButton("Save (S)")
        self.prev_button = QPushButton("Previous Prompt (B)")
        self.next_button = QPushButton("Next Prompt (N)")
        self.delete_button = QPushButton("Delete (Ctrl+D)")
        
        # Connect buttons
        self.record_button.clicked.connect(self.toggle_recording)
        self.play_button.clicked.connect(self.play_recording)
        self.save_button.clicked.connect(self.save_recording)
        self.prev_button.clicked.connect(self.prev_prompt)
        self.next_button.clicked.connect(self.next_prompt)
        self.delete_button.clicked.connect(self.delete_selected)
        
        # Recordings list
        self.recordings_list = QListWidget()
        self.recordings_list.itemDoubleClicked.connect(self.play_selected)
        
        # Status bar
        self.status_bar = self.statusBar()
        self.update_status(f"Ready | Output Directory: {os.path.abspath(self.args.save_dir)}")
        
        # Layout
        button_layout = QVBoxLayout()
        for btn in [self.record_button, self.play_button, 
                   self.save_button, self.prev_button, self.next_button, self.delete_button]:
            btn.setMinimumHeight(40)
            button_layout.addWidget(btn)
        
        self.layout.addWidget(self.prompt_label)
        self.layout.addLayout(button_layout)
        self.layout.addWidget(self.recordings_list)
        self.central_widget.setLayout(self.layout)
        
        # Initialize variables
        self.prompts = []
        self.current_prompt = ""
        self.recordings = []
        self.current_prompt_index = 0

    def init_shortcuts(self):
        shortcuts = [
            (Qt.Key.Key_Space, self.toggle_recording),
            (Qt.Key.Key_P, self.play_recording),
            (Qt.Key.Key_S, self.save_recording),
            (Qt.Key.Key_B, self.prev_prompt),
            (Qt.Key.Key_N, self.next_prompt),
            (QKeySequence("Ctrl+D"), self.delete_selected)
        ]
        
        for key, callback in shortcuts:
            action = QAction(self)
            action.setShortcut(key)
            action.triggered.connect(callback)
            self.addAction(action)

    def update_status(self, message):
        self.status_bar.showMessage(message)
        
    def load_prompts_from_file(self, filename):
        try:
            with open(filename, 'r', encoding='utf-8') as file:
                self.prompts = [line.strip() for line in file if line.strip()]
            
            if self.args.prompt_len_soft_max > 0:
                self.prompts = [p for p in self.prompts if len(p) <= self.args.prompt_len_soft_max]
                
            self.next_prompt()
            self.update_status(f"Loaded {len(self.prompts)} prompts")
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to load prompts: {str(e)}")

    def check_unsaved_and_proceed(self):
        """Check if there is unsaved audio and prompt the user."""
        if self.unsaved_audio and self.audio_buffer:
            reply = QMessageBox.question(
                self, 'Unsaved Recording',
                "You have an unsaved recording. Do you want to discard it and move on?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
            )
            if reply == QMessageBox.StandardButton.No:
                return False  # User chose not to proceed
        
        self.unsaved_audio = False
        self.audio_buffer = []  # Clear buffer
        return True

    def next_prompt(self):
        if not self.prompts:
            self.update_status("No prompts available")
            return
            
        if not self.check_unsaved_and_proceed():
            return
            
        if self.args.prompt_selection == "ordered":
            if self.current_prompt_index >= len(self.prompts):
                self.update_status("Reached end of prompts")
                return
            self.current_prompt = self.prompts[self.current_prompt_index]
            self.current_prompt_index += 1
        elif self.args.prompt_selection == "sequential":
            if self.current_prompt_index >= len(self.prompts):
                self.current_prompt_index = 0
            self.current_prompt = self.prompts[self.current_prompt_index]
            self.current_prompt_index += 1
        else:  # random
            self.current_prompt = random.choice(self.prompts)
            
        self.prompt_label.setText(self.current_prompt)
        self.update_status("Prompt ready - Press Space to record")

    def prev_prompt(self):
        if not self.prompts or self.args.prompt_selection == "random":
            self.update_status("Previous not available in random mode")
            return
            
        if not self.check_unsaved_and_proceed():
            return
            
        if self.current_prompt_index > 1:
            self.current_prompt_index -= 2  # Go back 2 because next_prompt increments by 1
            self.current_prompt = self.prompts[self.current_prompt_index]
            self.current_prompt_index += 1
            self.prompt_label.setText(self.current_prompt)
            self.update_status("Previous prompt loaded - Press Space to record")
        else:
            self.update_status("Already at the beginning")

    def toggle_recording(self):
        if not self.current_prompt:
            self.update_status("No prompt selected")
            return
            
        if not self.is_recording:
            # Start recording
            self.audio_buffer = []
            self.unsaved_audio = False  # Reset flag
            self.is_recording = True
            self.record_button.setText("Stop Recording (Space)")
            self.update_status("Recording...")
            
            self.stream = sd.InputStream(
                samplerate=self.sample_rate,
                channels=self.channels,
                dtype=self.dtype,
                callback=self.audio_callback
            )
            self.stream.start()
        else:
            # Stop recording
            self.is_recording = False
            self.record_button.setText("Start Recording (Space)")
            self.stream.stop()
            self.stream.close()
            self.unsaved_audio = True  # Mark as unsaved
            self.update_status("Recording stopped - Press P to play or S to save")

    def audio_callback(self, indata, frames, time, status):
        if self.is_recording:
            self.audio_buffer.append(indata.copy())

    def save_recording(self):
        if not self.audio_buffer or not self.current_prompt:
            self.update_status("Nothing to save")
            QMessageBox.warning(self, "Error", "No recording to save!")
            return
        
        # Ensure directory exists
        os.makedirs(self.args.save_dir, exist_ok=True)
        
        # Generate Kaldi-compatible filename: speaker_timestamp.wav
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        utt_id = f"{self.speaker_name}_{timestamp}"
        filename = os.path.join(self.args.save_dir, f"{utt_id}.wav")
        self.current_output_file = filename
        
        # Save WAV
        audio_data = np.concatenate(self.audio_buffer)
        with wave.open(filename, 'wb') as wav_file:
            wav_file.setnchannels(self.channels)
            wav_file.setsampwidth(self.bit_depth // 8)
            wav_file.setframerate(self.sample_rate)
            wav_file.writeframes(audio_data.tobytes())
        
        # Save to TSV
        tsv_path = os.path.join(self.args.save_dir, "recordings.tsv")
        file_exists = os.path.isfile(tsv_path)
        with open(tsv_path, 'a', newline='', encoding='utf-8') as tsv_file:
            writer = csv.writer(tsv_file, delimiter='\t')
            if not file_exists:
                writer.writerow(["speaker", "utt_id", "filename", "prompt", "timestamp", "sample_rate", "bit_depth"])
            writer.writerow([
                self.speaker_name,
                utt_id,
                os.path.basename(filename),
                self.current_prompt, 
                timestamp,
                self.sample_rate,
                self.bit_depth
            ])
            
        # Automatically generate Kaldi files (wav.scp, text, utt2spk)
        kaldi_wav_scp = os.path.join(self.args.save_dir, "wav.scp")
        kaldi_text = os.path.join(self.args.save_dir, "text")
        kaldi_utt2spk = os.path.join(self.args.save_dir, "utt2spk")
        
        with open(kaldi_wav_scp, 'a', encoding='utf-8') as f:
            f.write(f"{utt_id} {os.path.abspath(filename)}\n")
        with open(kaldi_text, 'a', encoding='utf-8') as f:
            f.write(f"{utt_id} {self.current_prompt}\n")
        with open(kaldi_utt2spk, 'a', encoding='utf-8') as f:
            f.write(f"{utt_id} {self.speaker_name}\n")
        
        # Update UI
        self.recordings.append(filename)
        self.recordings_list.addItem(f"{utt_id}: {self.current_prompt[:50]}...")
        self.update_status(f"Saved: {os.path.basename(filename)}")
        
        self.unsaved_audio = False  # Mark as saved
        
        # Auto-next if configured
        if self.args.auto_next:
            QTimer.singleShot(500, self.next_prompt)

    def play_recording(self):
        if not self.audio_buffer:
            self.update_status("No recording to play")
            QMessageBox.warning(self, "Error", "No recording to play!")
            return
        
        audio_data = np.concatenate(self.audio_buffer)
        sd.play(audio_data, self.sample_rate)
        self.update_status("Playing last recording...")

    def play_selected(self, item):
        index = self.recordings_list.row(item)
        filename = self.recordings[index]
        
        try:
            with wave.open(filename, 'rb') as wav_file:
                frames = wav_file.readframes(wav_file.getnframes())
                audio_data = np.frombuffer(frames, dtype=self.dtype)
                sd.play(audio_data, self.sample_rate)
                self.update_status(f"Playing: {os.path.basename(filename)}")
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to play: {str(e)}")

    def delete_selected(self):
        selected = self.recordings_list.currentRow()
        if selected == -1:
            self.update_status("No recording selected")
            return
            
        reply = QMessageBox.question(
            self, 'Confirm Delete',
            "Delete this recording permanently?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        
        if reply == QMessageBox.StandardButton.Yes:
            try:
                filename = self.recordings.pop(selected)
                os.remove(filename)
                self.recordings_list.takeItem(selected)
                
                # Remove from TSV
                tsv_path = os.path.join(self.args.save_dir, "recordings.tsv")
                if os.path.exists(tsv_path):
                    with open(tsv_path, 'r', encoding='utf-8') as tsv_file:
                        lines = list(csv.reader(tsv_file, delimiter='\t'))
                    
                    basename = os.path.basename(filename)
                    lines = [line for line in lines if len(line) > 2 and line[2] != basename]
                    
                    with open(tsv_path, 'w', newline='', encoding='utf-8') as tsv_file:
                        writer = csv.writer(tsv_file, delimiter='\t')
                        writer.writerows(lines)
                
                self.update_status("Recording deleted")
            except Exception as e:
                QMessageBox.critical(self, "Error", f"Delete failed: {str(e)}")

def parse_args():
    parser = argparse.ArgumentParser(
        description="Speech Training Recorder (LU Lab., Myanmar) - Record prompted speech",
        formatter_class=argparse.RawTextHelpFormatter,
        epilog="Example usages:\n"
               "  recorder.py -p isolated.txt -m ordered\n"
               "  recorder.py -p script.txt -m ordered -d custom_folder\n"
               "  recorder.py -p spoken.txt -m sequential -c 50\n"
               "  recorder.py -p phrases.txt -m random -a"
    )
    
    parser.add_argument("-p", "--prompts_filename",
                       help="text file containing prompts (one per line)")
    
    parser.add_argument("-d", "--save_dir",
                       default="",
                       help="custom output directory (default: auto-generated, e.g., rec_1439_28Aug2026)")
    
    parser.add_argument("-m", "--prompt_selection",
                       choices=["random", "ordered", "sequential"],
                       default="ordered",
                       help="prompt selection mode (default: ordered)\n"
                            "  ordered:    Goes through all prompts top-to-bottom and stops at the end.\n"
                            "              (Ignores -c count limit)\n"
                            "  sequential: Takes the first N prompts (-c count) and loops them infinitely.\n"
                            "  random:     Randomly selects N prompts (-c count) from the file.")
    
    parser.add_argument("-c", "--prompts_count",
                       type=int, default=300,
                       help="max prompts to use (default: 300). Used by 'sequential' and 'random' modes.")
    
    parser.add_argument("-l", "--prompt_len_soft_max",
                       type=int, default=0,
                       help="maximum prompt length in characters (0=no limit)")
    
    parser.add_argument("-a", "--auto_next",
                       action="store_true",
                       help="auto-advance to next prompt after save")
    
    parser.add_argument("-sr", "--sample_rate",
                       type=int, choices=[8000, 16000, 44100, 48000],
                       default=16000,
                       help="sample rate in Hz (default: 16000)")
    
    parser.add_argument("-b", "--bit_depth",
                       type=int, choices=[16, 32], default=16,
                       help="bit depth (16 or 32, default: 16)")
    
    return parser.parse_args()
 
if __name__ == "__main__":
    args = parse_args()
    app = QApplication(sys.argv)
    
    # Set application font
    font = QFont("Myanmar3") if "Myanmar3" in QFontDatabase.families() else QFont()
    app.setFont(font)
    
    recorder = SpeechRecorder(args)
    recorder.show()
    sys.exit(app.exec())
    
