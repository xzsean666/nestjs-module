import json
import re


def extract_words(file_path):
    words = []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            # Skip potential header lines
            for _ in range(3):
                try:
                    next(f)
                except StopIteration:
                    # Handle cases where file has fewer than 3 lines
                    f.seek(0)  # Reset file pointer if needed
                    break

            for line in f:
                line = line.strip()
                # Basic check for lines containing word entries
                if line and " " in line and "[" in line:
                    # Assuming the word is the first part before the first space
                    parts = line.split(" ", 1)
                    word = parts[0]
                    # Clean up the word, remove trailing non-alphabetic characters
                    word = re.sub(r"[^a-zA-Z]+$", "", word)
                    if word:
                        words.append(word)

    except FileNotFoundError:
        print(f"Error: File not found at {file_path}")
        return None
    except Exception as e:
        print(f"An error occurred: {e}")
        return None

    return words


if __name__ == "__main__":
    file_path = "src/script/raw/cet4.txt"
    output_file = "cet4_words.json"
    word_list = extract_words(file_path)

    if word_list is not None:
        try:
            with open(output_file, "w", encoding="utf-8") as outfile:
                json.dump(word_list, outfile, ensure_ascii=False, indent=4)
            print(f"Successfully extracted words and saved to {output_file}")
        except Exception as e:
            print(f"Error writing to file {output_file}: {e}")
