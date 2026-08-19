# Translation services - Google Translate GTX + OmniRoute + LLM Custom Provider + Grammar & Tenses Analyzer
import json
import re
import requests
import hashlib
from typing import Dict, List, Optional
from django.conf import settings
from django.core.cache import cache
from .models import WordTranslation, SentenceTranslation
from reader.books.models import Sentence


POS_MAP = {
    'noun': '🏷️ Kata Benda (Noun)',
    'verb': '⚡ Kata Kerja (Verb)',
    'adjective': '🎨 Kata Sifat (Adjective)',
    'adverb': '📍 Kata Keterangan (Adverb)',
    'preposition': '🧭 Kata Depan (Preposition)',
    'pronoun': '👤 Kata Ganti (Pronoun)',
    'conjunction': '🔗 Kata Hubung (Conjunction)',
    'interjection': '💥 Kata Seru (Interjection)',
    'abbreviation': '🔤 Singkatan (Abbreviation)',
    'phrase': '💬 Ungkapan (Phrase)',
}


class AsianTokenizer:
    """Segment Non-Latin scripts (Japanese, Mandarin, Korean, Arabic, Russian, Thai) into 3-Layer Word Tokens: [Aksara -> Latin -> Meaning ID]"""

    @staticmethod
    def get_token_pairs(text: str, target_lang: str) -> List[Dict]:
        clean_lang = (target_lang or 'id').lower()
        if not text or clean_lang not in ['ja', 'zh-cn', 'zh', 'ko', 'ar', 'ru', 'th', 'hi']:
            return []
        
        # For Mandarin Chinese (zh-CN), extract individual Hanzi characters for 1-to-1 Pīnyīn & Meaning alignment
        if clean_lang in ['zh-cn', 'zh']:
            raw_tokens = [c for c in text if re.match(r'[\u4e00-\u9faf]', c)]
            grouped = raw_tokens[:25]
        elif clean_lang in ['ar', 'ru', 'ko', 'hi', 'th']:
            pattern = r'[\u0600-\u06ff]+|[\u0400-\u04ff]+|[\u0e00-\u0e7f]+|[\uac00-\ud7af]+|[\u0900-\u097f]+|[a-zA-Z0-9]+'
            grouped = [t.strip() for t in re.findall(pattern, text) if t and t.strip() and not re.match(r'^[,\.!\?、。;\s\-\u060c\u061b]+$', t)][:25]
        else:
            # Japanese: group Kana/Kanji tokens
            pattern = r'[\u4e00-\u9faf]+|[\u3040-\u309f]+|[\u30a0-\u30ff]+|[a-zA-Z0-9]+'
            raw_tokens = [t.strip() for t in re.findall(pattern, text) if t and t.strip() and not re.match(r'^[,\.!\?、。;\s\-]+$', t)]
            grouped = []
            cur = ""
            for t in raw_tokens:
                cur += t
                if len(cur) >= 2 or re.search(r'[\u4e00-\u9faf]', t):
                    grouped.append(cur)
                    cur = ""
            if cur:
                grouped.append(cur)
            grouped = grouped[:25]
            
        pairs = []
        for token in grouped:
            clean_tok = re.sub(r'[\u060c\u061b,\.!\?]', '', token).strip()
            if not clean_tok:
                continue
            
            # Fetch 3 layers: [Original Script Token -> Latin Transliteration -> Indonesian Meaning]
            params = {
                "client": "gtx",
                "sl": clean_lang,
                "tl": "id",  # Translate to Indonesian mother tongue
                "dt": ["t", "rm"],
                "q": clean_tok
            }
            headers = {"User-Agent": "Mozilla/5.0"}
            try:
                res = requests.get("https://translate.googleapis.com/translate_a/single", params=params, headers=headers, timeout=3).json()
                meaning = ""
                romaji = ""
                if res and len(res) > 0 and res[0] and len(res[0]) > 0:
                    if len(res[0][0]) > 0 and res[0][0][0]:
                        meaning = res[0][0][0]
                    if len(res[0]) > 1 and res[0][1]:
                        if len(res[0][1]) > 3 and res[0][1][3]:
                            romaji = res[0][1][3]
                        elif len(res[0][1]) > 2 and res[0][1][2]:
                            romaji = res[0][1][2]
                    elif len(res[0][0]) > 2 and res[0][0][2]:
                        romaji = res[0][0][2]
                pairs.append({"word": clean_tok, "latin": romaji or clean_tok, "meaning": meaning or clean_tok})
            except Exception:
                pairs.append({"word": clean_tok, "latin": clean_tok, "meaning": clean_tok})
                
        return pairs


class GrammarAnalyzer:
    """Analyze sentence tenses (from 16 English tenses) and S+V+O syntax structure"""

    @staticmethod
    def analyze(sentence_text: str) -> Dict:
        text = sentence_text.strip()
        words = re.findall(r'\b[a-zA-Z]+\b', text)
        
        # 16 Tenses Detection Rules
        tense = "Simple Present Tense (Kejadian Rutin / Umum)"
        if re.search(r'\b(had\s+\w+ed|had\s+\w+en|had\s+been)\b', text, re.I):
            tense = "Past Perfect Tense (Kejadian Lampau Sebelum Lampau Lainnya)"
        elif re.search(r'\b(has\s+\w+ed|have\s+\w+ed|has\s+\w+en|have\s+\w+en|has\s+been|have\s+been)\b', text, re.I):
            tense = "Present Perfect Tense (Kejadian Berlangsung dari Lampau sampai Saat Ini)"
        elif re.search(r'\b(will\s+have\s+\w+ed|will\s+have\s+\w+en)\b', text, re.I):
            tense = "Future Perfect Tense (Kejadian Selesai di Masa Depan)"
        elif re.search(r'\b(was\s+\w+ing|were\s+\w+ing)\b', text, re.I):
            tense = "Past Continuous Tense (Kejadian Sedang Berlangsung di Masa Lampau)"
        elif re.search(r'\b(is\s+\w+ing|am\s+\w+ing|are\s+\w+ing)\b', text, re.I):
            tense = "Present Continuous Tense (Kejadian Sedang Berlangsung Saat Ini)"
        elif re.search(r'\b(will\s+be\s+\w+ing|shall\s+be\s+\w+ing)\b', text, re.I):
            tense = "Future Continuous Tense (Kejadian Sedang Berlangsung di Masa Depan)"
        elif re.search(r'\b(will\s+|shall\s+|going\s+to\s+)\b', text, re.I):
            tense = "Simple Future Tense (Kejadian Masa Depan)"
        elif re.search(r'\b(used|focused|defined|differed|went|saw|did|had|was|were|\w+ed)\b', text, re.I):
            tense = "Simple Past Tense (Kejadian Masa Lampau)"

        # Classify verbs, nouns, adjectives
        verbs = []
        nouns = []
        adjectives = []

        for w in words:
            w_lower = w.lower()
            if len(w_lower) < 3:
                continue
            if re.search(r'(ing|ed|es|ized|ated|ised)$', w_lower) or w_lower in ['is', 'are', 'was', 'were', 'have', 'has', 'had', 'use', 'differ']:
                if w_lower not in [v['word'].lower() for v in verbs] and len(verbs) < 5:
                    verbs.append({'word': w, 'pos': '⚡ Verb (Kata Kerja)'})
            elif re.search(r'(tion|ment|ence|ance|ity|ness|er|or|system|user|device|time|trial)$', w_lower) or w_lower in ['user', 'system', 'device', 'time', 'data', 'figure']:
                if w_lower not in [n['word'].lower() for n in nouns] and len(nouns) < 5:
                    nouns.append({'word': w, 'pos': '🏷️ Noun (Kata Benda)'})
            elif re.search(r'(al|ive|ous|ful|able|ible|ic|ent|ant)$', w_lower):
                if w_lower not in [a['word'].lower() for a in adjectives]:
                    adjectives.append({'word': w, 'pos': '🎨 Adjective (Kata Sifat)'})

        subj = words[0] if words else 'Subject'
        verb = verbs[0]['word'] if verbs else 'Predicate'
        obj = nouns[0]['word'] if nouns else 'Object'
        structure = f"Subjek ({subj}) + Predikat/Verb ({verb}) + Objek ({obj})"

        return {
            "tense": tense,
            "structure": structure,
            "grammar_details": {
                "verbs": [v['word'] for v in verbs],
                "nouns": [n['word'] for n in nouns],
                "adjectives": [a['word'] for a in adjectives]
            }
        }


class GoogleTranslateClient:
    """Free Google Translate Client with Dictionary Multi-Meaning Support & Latin Transliteration"""
    
    BASE_URL = "https://translate.googleapis.com/translate_a/single"
    
    @staticmethod
    def translate_word(word: str, target_lang: str = "id") -> Dict:
        params = {
            "client": "gtx",
            "sl": "auto",
            "tl": target_lang,
            "dt": ["t", "bd", "rm"],
            "q": word
        }
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
        }
        try:
            res = requests.get(GoogleTranslateClient.BASE_URL, params=params, headers=headers, timeout=10).json()
            
            primary = ""
            ipa = ""
            transliteration = ""
            
            if res and len(res) > 0 and res[0] and len(res[0]) > 0 and res[0][0]:
                primary = res[0][0][0]
            
            if len(res[0]) > 1 and res[0][1]:
                if len(res[0][1]) > 2 and res[0][1][2]:
                    transliteration = res[0][1][2]
                if len(res[0][1]) > 3 and res[0][1][3]:
                    ipa = res[0][1][3] or ""

            other_meanings = []
            if len(res) > 1 and res[1]:
                for pos_group in res[1]:
                    pos_name = pos_group[0]
                    meanings_list = pos_group[1]
                    if meanings_list:
                        pos_clean = pos_name.lower().strip() if pos_name else ''
                        indonesian_pos = POS_MAP.get(pos_clean, f'📝 {pos_name.capitalize()}' if pos_name else '')
                        label = f"{indonesian_pos}: {', '.join(meanings_list[:4])}" if indonesian_pos else ', '.join(meanings_list[:4])
                        other_meanings.append(label)

            insight = f"Tips Pemula: Kata '{word}' sering digunakan dalam pola frasa umum. Perhatikan kelas katanya untuk memahami posisinya dalam kalimat."

            return {
                "contextual_meaning": primary or word,
                "transliteration": transliteration,
                "other_meanings": other_meanings,
                "insight": insight,
                "ipa": ipa,
                "is_false_friend": False,
                "confidence": 1.0
            }
        except Exception as e:
            return {
                "contextual_meaning": word,
                "transliteration": "",
                "other_meanings": [str(e)],
                "insight": "",
                "ipa": "",
                "is_false_friend": False,
                "confidence": 0.5
            }

    @staticmethod
    def translate_sentence(text: str, target_lang: str = "id") -> Dict:
        cleaned_text = re.sub(r'\s+', ' ', text).strip()
        params = {
            "client": "gtx",
            "sl": "auto",
            "tl": target_lang,
            "dt": ["t", "rm"],
            "q": cleaned_text
        }
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
        }
        try:
            res = requests.get(GoogleTranslateClient.BASE_URL, params=params, headers=headers, timeout=10).json()
            translated_text = ""
            transliteration = ""
            
            if res and isinstance(res, list) and len(res) > 0 and isinstance(res[0], list):
                for item in res[0]:
                    if isinstance(item, list):
                        if len(item) > 0 and item[0]:
                            translated_text += item[0] + " "
                        if len(item) > 2 and item[2]:
                            transliteration += item[2] + " "
                        elif len(item) > 3 and item[3]:
                            transliteration += item[3] + " "
            
            grammar = GrammarAnalyzer.analyze(cleaned_text)
            token_pairs = AsianTokenizer.get_token_pairs(translated_text.strip(), target_lang)
            grammar_details = grammar["grammar_details"]
            grammar_details["token_pairs"] = token_pairs

            return {
                "indonesian_text": translated_text.strip() or cleaned_text,
                "transliteration": transliteration.strip(),
                "tense": grammar["tense"],
                "structure": grammar["structure"],
                "grammar_details": grammar_details,
                "notes": f"Analisis Tata Bahasa: Kalimat ini disusun menggunakan struktur {grammar['structure']}."
            }
        except Exception:
            return {
                "indonesian_text": cleaned_text,
                "transliteration": "",
                "tense": "Simple Present Tense",
                "structure": "Subjek + Predikat + Objek",
                "grammar_details": {},
                "notes": ""
            }


class LLMClient:
    """OpenAI-compatible LLM Client supporting OmniRoute Proxy and Custom AI Providers (OpenAI, OpenRouter, Custom API Key)"""
    
    def __init__(self, base_url: str = None, api_key: str = None, model: str = None):
        self.base_url = (base_url or settings.OMNIROUTE_URL).rstrip('/')
        self.model = model or settings.OMNIROUTE_MODEL
        self.api_key = api_key or getattr(settings, 'OMNIROUTE_API_KEY', 'omniroute-local')
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.api_key}'
        })
    
    def chat_completion(self, messages: List[Dict], temperature: float = 0.3, max_tokens: int = 1000) -> Dict:
        payload = {
            'model': self.model,
            'messages': messages,
            'temperature': temperature,
            'max_tokens': max_tokens,
        }
        response = self.session.post(
            f'{self.base_url}/chat/completions',
            json=payload,
            timeout=30
        )
        response.raise_for_status()
        return response.json()
    
    def get_completion_text(self, messages: List[Dict]) -> str:
        result = self.chat_completion(messages)
        choices = result.get('choices', [])
        if choices and len(choices) > 0:
            msg = choices[0].get('message', {})
            content = msg.get('content', '')
            if content:
                return content
            text = choices[0].get('text', '')
            if text:
                return text
        return ""


class TranslationService:
    """High-level translation service with caching and Multi-Engine / Custom Provider Support"""
    
    def _cache_key(self, prefix: str, *parts: str) -> str:
        key = ':'.join([prefix] + list(parts))
        return hashlib.sha256(key.encode()).hexdigest()[:32]
    
    def translate_word_contextual(self, sentence: Sentence, word: str, target_lang: str = "id", engine: str = "google",
                                  custom_base_url: str = None, custom_api_key: str = None, custom_model: str = None) -> WordTranslation:
        """Get word translation via Google Translate (free & multi-meaning) or OmniRoute LLM / Custom AI Provider"""
        cache_key = self._cache_key('word_trans', str(sentence.id), word.lower(), target_lang, engine, custom_model or '')
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        if engine == "google":
            data = GoogleTranslateClient.translate_word(word, target_lang=target_lang)
        else:
            client = LLMClient(base_url=custom_base_url, api_key=custom_api_key, model=custom_model)
            prompt = self._build_word_prompt(sentence.text, word, target_lang)
            try:
                response = client.get_completion_text([
                    {'role': 'system', 'content': prompt['system']},
                    {'role': 'user', 'content': prompt['user']}
                ])
                data = json.loads(response)
            except Exception:
                data = GoogleTranslateClient.translate_word(word, target_lang=target_lang)
        
        translation, _ = WordTranslation.objects.update_or_create(
            sentence=sentence,
            word_lower=word.lower(),
            target_lang=target_lang,
            engine=engine,
            defaults={
                'word': word,
                'contextual_meaning': data.get('contextual_meaning', ''),
                'transliteration': data.get('transliteration', ''),
                'other_meanings': data.get('other_meanings', []),
                'insight': data.get('insight', f"Tips Pemula: Kata '{word}' sering digunakan dalam pola frasa umum."),
                'ipa': data.get('ipa', ''),
                'audio_url': data.get('audio_url', ''),
                'is_false_friend': data.get('is_false_friend', False),
                'confidence': data.get('confidence', 1.0),
            }
        )
        
        cache.set(cache_key, translation, timeout=86400 * 30)
        return translation
    
    def _build_word_prompt(self, sentence: str, word: str, target_lang: str = "id") -> Dict[str, str]:
        return {
            'system': (
                f'Anda adalah kamus penerjemah pemula bahasa ke kode "{target_lang}". '
                'Berikan kelas kata dalam Bahasa Indonesia yang ramah pemula seperti "🏷️ Kata Benda (Noun)", "⚡ Kata Kerja (Verb)", "🎨 Kata Sifat (Adjective)", "📍 Kata Keterangan (Adverb)". '
                'Berikan output HANYA dalam format JSON berikut:\n'
                '{\n'
                '  "contextual_meaning": "arti utama yang PALING SESUAI konteks kalimat",\n'
                '  "transliteration": "panduan cara baca latin jika terjemahan menggunakan karakter non-latin",\n'
                '  "other_meanings": ["⚡ Kata Kerja (Verb): arti 1, arti 2", "🏷️ Kata Benda (Noun): arti 3"],\n'
                '  "insight": "Tips penggunaan kata untuk pemula",\n'
                '  "ipa": "IPA pronunciation",\n'
                '  "audio_url": "",\n'
                '  "is_false_friend": true/false,\n'
                '  "confidence": 0.0-1.0\n'
                '}'
            ),
            'user': f'Kalimat: "{sentence}"\nKata target: "{word}"'
        }
    
    def translate_sentence(self, sentence: Sentence, target_lang: str = "id", engine: str = "google",
                           custom_base_url: str = None, custom_api_key: str = None, custom_model: str = None) -> SentenceTranslation:
        """Get full sentence translation via Google Translate or OmniRoute LLM / Custom AI Provider"""
        cache_key = self._cache_key('sent_trans', str(sentence.id), target_lang, engine, custom_model or '')
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        if engine == "google":
            data = GoogleTranslateClient.translate_sentence(sentence.text, target_lang=target_lang)
        else:
            client = LLMClient(base_url=custom_base_url, api_key=custom_api_key, model=custom_model)
            grammar = GrammarAnalyzer.analyze(sentence.text)
            prompt = (
                'Anda adalah penerjemah sastra dan akademis profesional. '
                f'Terjemahkan kalimat berikut ke kode bahasa "{target_lang}" secara alami, presisi, dan elegan. '
                'Tentukan jenis dari 16 Tenses bahasa Inggris dan pola sintaksis Subjek + Predikat/Verb + Objek. '
                'Output HANYA JSON:\n'
                '{\n'
                '  "indonesian_text": "terjemahan murni yang natural dan mengalir",\n'
                '  "transliteration": "panduan cara baca latin jika bahasa target berbasis karakter bukan latin seperti pinyin romaji romaja",\n'
                '  "tense": "jenis dari 16 tenses bahasa Inggris",\n'
                '  "structure": "struktur S+V+O",\n'
                '  "notes": "catatan konteks atau penjelasan istilah (kosongkan jika tidak ada)"\n'
                '}'
            )
            try:
                response = client.get_completion_text([
                    {'role': 'system', 'content': prompt},
                    {'role': 'user', 'content': sentence.text}
                ])
                parsed = json.loads(response)
                token_pairs = AsianTokenizer.get_token_pairs(parsed.get('indonesian_text', sentence.text), target_lang)
                grammar_details = grammar['grammar_details']
                grammar_details['token_pairs'] = token_pairs
                data = {
                    'indonesian_text': parsed.get('indonesian_text', sentence.text),
                    'transliteration': parsed.get('transliteration', ''),
                    'tense': parsed.get('tense', grammar['tense']),
                    'structure': parsed.get('structure', grammar['structure']),
                    'grammar_details': grammar_details,
                    'notes': parsed.get('notes', '')
                }
            except Exception:
                data = GoogleTranslateClient.translate_sentence(sentence.text, target_lang=target_lang)
        
        translation, _ = SentenceTranslation.objects.update_or_create(
            sentence=sentence,
            target_lang=target_lang,
            engine=engine,
            defaults={
                'indonesian_text': data.get('indonesian_text', sentence.text),
                'transliteration': data.get('transliteration', ''),
                'tense': data.get('tense', ''),
                'structure': data.get('structure', ''),
                'grammar_details': data.get('grammar_details', {}),
                'notes': data.get('notes', ''),
                'model_used': "google-gtx" if engine == "google" else (custom_model or settings.OMNIROUTE_MODEL),
            }
        )
        
        cache.set(cache_key, translation, timeout=86400 * 30)
        return translation


# Singleton instance
translation_service = TranslationService()
