#!/usr/bin/env python3
import json
import os

input_file = "raw/cet6.txt"
output_dir = "../vocabularys"
output_file = os.path.join(output_dir, "cet6.json")

words = []
with open(input_file, "r") as f:
    for line in f:
        word = line.strip()
        if word:
            words.append(word)

# Create output directory if it doesn't exist
os.makedirs(output_dir, exist_ok=True)

with open(output_file, "w") as f:
    json.dump(words, f, indent=2)

print(f"Successfully extracted {len(words)} words and saved to {output_file}")
