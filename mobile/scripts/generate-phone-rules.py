"""Generate country validation from the backend's pinned phonenumbers metadata.
Run from repo root: backend/.venv/bin/python mobile/scripts/generate-phone-rules.py
"""
import json
from pathlib import Path
from phonenumbers import PhoneMetadata
root = Path(__file__).resolve().parents[1]
countries = json.loads((root / 'src/data/countries.json').read_text())
rules = {}
for country in countries:
    meta = PhoneMetadata.metadata_for_region(country['region'])
    desc = meta.mobile if meta.mobile and meta.mobile.national_number_pattern else meta.general_desc
    lengths = [n for n in desc.possible_length if n > 0]
    rules[country['region']] = {'lengths': lengths, 'pattern': desc.national_number_pattern, 'prefix': meta.national_prefix or ''}
(root / 'src/data/phone-rules.json').write_text(json.dumps(rules, indent=2) + '\n')
