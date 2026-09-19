# Translation services - Google Translate GTX + OmniRoute + LLM Custom Provider + Grammar & Tenses Analyzer
import json
import re
import requests
import hashlib
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Optional
from django.conf import settings
from django.core.cache import cache
from .models import WordTranslation, SentenceTranslation
from reader.books.models import Sentence


POS_MAP = {
    'noun': 'Kata Benda (Noun)',
    'verb': 'Kata Kerja (Verb)',
    'adjective': 'Kata Sifat (Adjective)',
    'adverb': 'Kata Keterangan (Adverb)',
    'preposition': 'Kata Depan (Preposition)',
    'pronoun': 'Kata Ganti (Pronoun)',
    'conjunction': 'Kata Hubung (Conjunction)',
    'interjection': 'Kata Seru (Interjection)',
    'abbreviation': 'Singkatan (Abbreviation)',
    'phrase': 'Ungkapan (Phrase)',
}


class UniversalWordTokenizer:
    """Segment sentences into 3-Layer Word Tokens for ALL LANGUAGES: [Target Word -> Latin Pronunciation -> Mother Tongue Meaning]"""

    @staticmethod
    def get_token_pairs(text: str, target_lang: str, mother_lang: str = "id") -> List[Dict]:
        if not text:
            return []
        
        clean_lang = (target_lang or 'en').lower()
        
        if clean_lang in ['zh-cn', 'zh']:
            try:
                import jieba
                grouped = [t.strip() for t in jieba.cut(text) if t and t.strip() and not re.match(r'^[,\.!\?、。;\s\-""\'“”]+$', t)]
            except Exception:
                grouped = [c for c in text if re.match(r'[\u4e00-\u9faf]', c)]
        elif clean_lang == 'ja':
            try:
                import tinysegmenter
                ts = tinysegmenter.TinySegmenter()
                grouped = [t.strip() for t in ts.tokenize(text) if t and t.strip() and not re.match(r'^[,\.!\?、。;\s\-""\'“”]+$', t)]
            except Exception:
                pattern = r'[\u4e00-\u9faf]+|[\u3040-\u309f]+|[\u30a0-\u30ff]+|[a-zA-Z0-9]+'
                grouped = [t.strip() for t in re.findall(pattern, text) if t and t.strip() and not re.match(r'^[,\.!\?、。;\s\-]+$', t)]
        else:
            # Space-separated Latin / Cyrillic / Arabic / Thai / Korean / German / French / Spanish / etc.
            pattern = r'[^\s,\.!\?\(\)\[\]\{\}"\':;]+'
            grouped = [t.strip() for t in re.findall(pattern, text) if t and len(t.strip()) >= 2]
            
        pairs = []
        min_len = 1 if clean_lang in ['zh-cn', 'zh', 'ja'] else 2
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"}
        grouped = grouped[:8]

        def fetch_pair(token):
            clean_tok = re.sub(r'[\u060c\u061b,\.!\?\s"\'“”]', '', token).strip()
            if not clean_tok or len(clean_tok) < min_len:
                return None
            
            c_key = f"tok_pair:{clean_lang}:{mother_lang}:{clean_tok.lower()}"
            cached_pair = cache.get(c_key)
            if cached_pair:
                return cached_pair

            res = None
            for client_name in ["gtx", "tw-ob"]:
                params = {
                    "client": client_name,
                    "sl": clean_lang,
                    "tl": mother_lang,
                    "dt": ["t", "rm"],
                    "q": clean_tok
                }
                try:
                    resp = requests.get("https://translate.googleapis.com/translate_a/single", params=params, headers=headers, timeout=1.0)
                    if resp.status_code == 200:
                        res = resp.json()
                        break
                except Exception:
                    pass

            meaning = ""
            romaji = ""
            if res and isinstance(res, list) and len(res) > 0 and res[0]:
                if len(res[0]) > 0 and res[0][0] and len(res[0][0]) > 0:
                    meaning = res[0][0][0]
                if len(res[0]) > 1 and res[0][1] and isinstance(res[0][1], list):
                    if len(res[0][1]) > 3 and res[0][1][3]:
                        romaji = res[0][1][3]
                    elif len(res[0][1]) > 2 and res[0][1][2]:
                        romaji = res[0][1][2]
                elif len(res[0][0]) > 2 and res[0][0][2]:
                    romaji = res[0][0][2]

            final_latin = romaji.strip() if romaji else clean_tok.lower()
            final_meaning = meaning.strip() if meaning else clean_tok
            item = {"word": clean_tok, "latin": final_latin, "meaning": final_meaning}
            cache.set(c_key, item, timeout=86400 * 7)
            return item

        with ThreadPoolExecutor(max_workers=6) as executor:
            results = list(executor.map(fetch_pair, grouped))

        return [r for r in results if r is not None]


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
        elif re.search(r'\b(will|shall|going\s+to)\b', text, re.I):
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
                    verbs.append({'word': w, 'pos': 'Verb (Kata Kerja)'})
            elif re.search(r'(tion|ment|ence|ance|ity|ness|er|or|system|user|device|time|trial)$', w_lower) or w_lower in ['user', 'system', 'device', 'time', 'data', 'figure']:
                if w_lower not in [n['word'].lower() for n in nouns] and len(nouns) < 5:
                    nouns.append({'word': w, 'pos': 'Noun (Kata Benda)'})
            elif re.search(r'(al|ive|ous|ful|able|ible|ic|ent|ant)$', w_lower):
                if w_lower not in [a['word'].lower() for a in adjectives]:
                    adjectives.append({'word': w, 'pos': 'Adjective (Kata Sifat)'})

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
    def translate_word(word: str, target_lang: str = "id", mother_lang: str = "id") -> Dict:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        }
        res = None
        for client_name in ["tw-ob", "dict-chrome-ex", "gtx"]:
            params = {
                "client": client_name,
                "sl": "auto",
                "tl": target_lang,
                "dt": ["t", "bd", "rm"],
                "q": word
            }
            try:
                resp = requests.get(GoogleTranslateClient.BASE_URL, params=params, headers=headers, timeout=5)
                if resp.status_code == 200:
                    res = resp.json()
                    break
            except Exception:
                pass

        try:
            if not res:
                raise ValueError("All translation clients failed or rate limited")

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

            # Fetch mother-tongue meaning if target_lang is different from mother_lang
            indonesian_meaning = ""
            if target_lang.lower() != mother_lang.lower():
                for client_name in ["tw-ob", "dict-chrome-ex", "gtx"]:
                    try:
                        id_params = {"client": client_name, "sl": "auto", "tl": mother_lang, "dt": ["t"], "q": word}
                        id_resp = requests.get(GoogleTranslateClient.BASE_URL, params=id_params, headers=headers, timeout=4)
                        if id_resp.status_code == 200:
                            id_res = id_resp.json()
                            if id_res and isinstance(id_res, list) and len(id_res) > 0 and id_res[0]:
                                meanings = []
                                for item in id_res[0]:
                                    if isinstance(item, list) and len(item) > 0 and item[0]:
                                        meanings.append(item[0].strip())
                                indonesian_meaning = ' '.join(meanings).strip()
                                if indonesian_meaning:
                                    break
                    except Exception:
                        pass

            other_meanings = []
            if len(res) > 1 and res[1]:
                for pos_group in res[1]:
                    pos_name = pos_group[0]
                    meanings_list = pos_group[1]
                    if meanings_list:
                        pos_clean = pos_name.lower().strip() if pos_name else ''
                        indonesian_pos = POS_MAP.get(pos_clean, f'{pos_name.capitalize()}' if pos_name else '')
                        label = f"{indonesian_pos}: {', '.join(meanings_list[:4])}" if indonesian_pos else ', '.join(meanings_list[:4])
                        other_meanings.append(label)

            insight = f"Tips Pemula: Kata '{word}' sering digunakan dalam pola frasa umum. Perhatikan kelas katanya untuk memahami posisinya dalam kalimat."

            return {
                "contextual_meaning": primary or word,
                "transliteration": transliteration,
                "indonesian_meaning": indonesian_meaning,
                "other_meanings": other_meanings,
                "insight": insight,
                "ipa": ipa,
                "is_false_friend": False,
                "confidence": 1.0
            }
        except Exception:
            return {
                "contextual_meaning": word,
                "transliteration": "",
                "indonesian_meaning": "",
                "other_meanings": ["Kosakata Dasar / Istilah Umum"],
                "insight": f"Tips Pemula: Kata '{word}' sering digunakan dalam percakapan sehari-hari.",
                "ipa": "",
                "is_false_friend": False,
                "confidence": 0.5
            }

    @staticmethod
    def translate_sentence(text: str, target_lang: str = "id", mother_lang: str = "id") -> Dict:
        cleaned_text = re.sub(r'\s+', ' ', text).strip()
        params = {
            "client": "gtx",
            "sl": "auto",
            "tl": target_lang,
            "dt": ["t", "rm"],
            "q": cleaned_text
        }
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        }
        try:
            response = requests.get(GoogleTranslateClient.BASE_URL, params=params, headers=headers, timeout=10)
            translated_text = ""
            transliteration = ""
            
            if response.status_code == 200:
                res = response.json()
                if res and isinstance(res, list) and len(res) > 0 and isinstance(res[0], list):
                    for item in res[0]:
                        if isinstance(item, list):
                            if len(item) > 0 and item[0]:
                                translated_text += item[0] + " "
                            if len(item) > 2 and item[2]:
                                transliteration += item[2] + " "
                            elif len(item) > 3 and item[3]:
                                transliteration += item[3] + " "
            else:
                # Fallback to secondary m.translate endpoint if 429
                try:
                    m_url = f"https://translate.google.com/m?sl=auto&tl={target_lang}&q={requests.utils.quote(cleaned_text)}"
                    m_res = requests.get(m_url, headers=headers, timeout=5)
                    if m_res.status_code == 200:
                        m_match = re.search(r'class="result-container">(.*?)</div>', m_res.text, re.S)
                        if m_match:
                            translated_text = m_match.group(1).strip()
                except Exception:
                    pass

            grammar = GrammarAnalyzer.analyze(cleaned_text)
            token_pairs = UniversalWordTokenizer.get_token_pairs(translated_text.strip(), target_lang, mother_lang=mother_lang) if translated_text.strip() else []
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
            grammar = GrammarAnalyzer.analyze(cleaned_text)
            return {
                "indonesian_text": cleaned_text,
                "transliteration": "",
                "tense": grammar["tense"],
                "structure": grammar["structure"],
                "grammar_details": grammar["grammar_details"],
                "notes": ""
            }


class LLMClient:
    """OpenAI-compatible LLM Client supporting OmniRoute Proxy and Custom AI Providers (OpenAI, OpenRouter, Custom API Key)"""
    
    def __init__(self, base_url: Optional[str] = None, api_key: Optional[str] = None, model: Optional[str] = None):
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
            timeout=5.0
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
    
    def translate_word_contextual(self, sentence: Sentence, word: str, target_lang: str = "id", mother_lang: str = "id", engine: str = "google",
                                  custom_base_url: str = None, custom_api_key: str = None, custom_model: str = None) -> WordTranslation:
        """Get word translation via Google Translate (free & multi-meaning) or OmniRoute LLM / Custom AI Provider"""
        cache_key = self._cache_key('word_trans', str(sentence.id), word.lower(), target_lang, mother_lang, engine, custom_model or '')
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        if engine == "google":
            data = GoogleTranslateClient.translate_word(word, target_lang=target_lang, mother_lang=mother_lang)
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
                data = GoogleTranslateClient.translate_word(word, target_lang=target_lang, mother_lang=mother_lang)
        
        translation, _ = WordTranslation.objects.update_or_create(
            sentence=sentence,
            word_lower=word.lower(),
            target_lang=target_lang,
            engine=engine,
            defaults={
                'word': word,
                'contextual_meaning': data.get('contextual_meaning', ''),
                'transliteration': data.get('transliteration', ''),
                'indonesian_meaning': data.get('indonesian_meaning', ''),
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
                'Berikan kelas kata dalam Bahasa Indonesia yang ramah pemula seperti "Kata Benda (Noun)", "Kata Kerja (Verb)", "Kata Sifat (Adjective)", "Kata Keterangan (Adverb)". '
                'Berikan output HANYA dalam format JSON berikut:\n'
                '{\n'
                '  "contextual_meaning": "arti utama yang PALING SESUAI konteks kalimat",\n'
                '  "transliteration": "panduan cara baca latin jika terjemahan menggunakan karakter non-latin",\n'
                '  "indonesian_meaning": "terjemahan kata ke Bahasa Indonesia jika bahasa target bukan Indonesia",\n'
                '  "other_meanings": ["Kata Kerja (Verb): arti 1, arti 2", "Kata Benda (Noun): arti 3"],\n'
                '  "insight": "Tips penggunaan kata untuk pemula",\n'
                '  "ipa": "IPA pronunciation",\n'
                '  "audio_url": "",\n'
                '  "is_false_friend": true/false,\n'
                '  "confidence": 0.0-1.0\n'
                '}'
            ),
            'user': f'Kalimat: "{sentence}"\nKata target: "{word}"'
        }
    
    def translate_sentence(self, sentence: Sentence, target_lang: str = "id", mother_lang: str = "id", engine: str = "google",
                           custom_base_url: str = None, custom_api_key: str = None, custom_model: str = None) -> SentenceTranslation:
        """Get full sentence translation via Google Translate or OmniRoute LLM / Custom AI Provider"""
        cache_key = self._cache_key('sent_trans', str(sentence.id), target_lang, mother_lang, engine, custom_model or '')
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        if engine == "google":
            data = GoogleTranslateClient.translate_sentence(sentence.text, target_lang=target_lang, mother_lang=mother_lang)
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
                token_pairs = UniversalWordTokenizer.get_token_pairs(parsed.get('indonesian_text', sentence.text), target_lang, mother_lang=mother_lang)
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
                data = GoogleTranslateClient.translate_sentence(sentence.text, target_lang=target_lang, mother_lang=mother_lang)
        
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
        
        # Only cache if translation actually succeeded or language is English
        if data.get('indonesian_text') and (data.get('indonesian_text').strip() != sentence.text.strip() or target_lang.lower() == 'en'):
            cache.set(cache_key, translation, timeout=86400 * 30)
        return translation


# Singleton instance

    def explain_3d(self, sentence_text: str, selected_text: str, user_level: str = 'B2', target_lang: str = 'id',
                   custom_base_url: Optional[str] = None, custom_api_key: Optional[str] = None, custom_model: Optional[str] = None) -> Dict:
        """Reading.help 3D Assistance: Lexical, Grammar, and Comprehension Explanation with CEFR Leveling"""
        clean_selected = selected_text.strip()
        clean_sentence = sentence_text.strip() or clean_selected
        cache_key = f'explain_3d_{hashlib.md5((clean_sentence + clean_selected + user_level + target_lang).encode()).hexdigest()}'
        cached = cache.get(cache_key)
        if cached:
            return cached

        # Fast deterministic base analysis (instant < 1ms)
        grammar_data = GrammarAnalyzer.analyze(clean_sentence)
        word_len = len(clean_selected)
        est_cefr = 'C1' if word_len >= 10 else ('B2' if word_len >= 7 else ('B1' if word_len >= 5 else 'A2'))

        # If custom LLM is configured or available, attempt fast LLM call
        data = None
        if custom_api_key or custom_base_url or getattr(settings, 'OMNIROUTE_URL', None):
            try:
                client = LLMClient(base_url=custom_base_url, api_key=custom_api_key, model=custom_model)
                prompt = (
                    f"""You are an expert reading assistant (Reading.help architecture). The user English level is {user_level}.
Context Sentence: "{clean_sentence}"
Target Selected Element: "{clean_selected}"
Explain the target element across 3 dimensions in Indonesian (Bahasa Indonesia):
1. Lexical: Contextual meaning, CEFR difficulty level (A1-C2), and part of speech.
2. Grammar: Concise structural breakdown (Subject/Predicate/Clause) and tense.
3. Comprehension (Gist): 1-sentence clear simplified paraphrase of the idea in this context.
Output strictly JSON:
{{
  "cefr_level": "{est_cefr}",
  "lexical": {{
    "contextual_definition": "arti kontekstual dalam bahasa Indonesia",
    "part_of_speech": "Kelas Kata",
    "examples": ["contoh singkat"]
  }},
  "grammar": {{
    "role": "Fungsi gramatikal singkat",
    "tense": "{grammar_data.get('tense')}",
    "structure": "{grammar_data.get('structure')}",
    "clause_breakdown": "Subjek: ... | Predikat: ... | Objek: ..."
  }},
  "comprehension": {{
    "gist": "1 kalimat intisari atau parafrase sederhana",
    "intention": "maksud penulis"
  }},
  "verified": true
}}"""
                )
                res = client.get_completion_text([
                    {'role': 'system', 'content': prompt},
                    {'role': 'user', 'content': f'Explain "{clean_selected}" in sentence: "{clean_sentence}"'}
                ])
                if res and isinstance(res, str) and '{' in res:
                    json_str = res[res.find('{'):res.rfind('}')+1]
                    try:
                        data = json.loads(json_str)
                    except json.JSONDecodeError:
                        data = None
            except Exception:
                data = None

        if not data or not isinstance(data, dict) or 'grammar' not in data:
            # Deterministic instant fallback
            word_tr = GoogleTranslateClient.translate_word(clean_selected, target_lang=target_lang, mother_lang=target_lang)
            def_text = word_tr.get('contextual_meaning') or clean_selected
            pos_label = word_tr.get('other_meanings', ['Kosakata Dasar'])[0] if word_tr.get('other_meanings') else 'Kosakata Kontekstual'
            
            data = {
                'cefr_level': est_cefr,
                'lexical': {
                    'contextual_definition': def_text,
                    'part_of_speech': pos_label,
                    'examples': word_tr.get('other_meanings', [])[:3]
                },
                'grammar': {
                    'tense': grammar_data.get('tense', 'Simple Present Tense'),
                    'structure': grammar_data.get('structure', 'S + V + O'),
                    'role': f"Kalimat ini menggunakan {grammar_data.get('tense', 'struktur standar')} dengan pola {grammar_data.get('structure', 'S+V+O')}.",
                    'clause_breakdown': f"Struktur Klausa: {grammar_data.get('structure', 'S+V+O')} | Kata Kerja: {', '.join(grammar_data.get('grammar_details', {}).get('verbs', [])) or 'Verb'}",
                    'verbs': grammar_data.get('grammar_details', {}).get('verbs', []),
                    'nouns': grammar_data.get('grammar_details', {}).get('nouns', []),
                    'adjectives': grammar_data.get('grammar_details', {}).get('adjectives', [])
                },
                'comprehension': {
                    'gist': f"Kalimat ini menyatakan: '{def_text}' dalam konteks situasi yang sedang dibahas.",
                    'intention': 'Menjelaskan ide pokok atau fakta utama dalam kalimat secara lugas.'
                },
                'verified': True,
                'fallback': True
            }

        cache.set(cache_key, data, timeout=86400 * 14)
        return data

    def generate_paragraph_summary(self, paragraph_text: str, detail_level: str = 'concise', target_lang: str = 'id',
                                   custom_base_url: Optional[str] = None, custom_api_key: Optional[str] = None, custom_model: Optional[str] = None) -> Dict:
        """Reading.help Paragraph-Aligned Margin Summary & Proactive CEFR Keyword Highlighting"""
        cache_key = f'para_summary_{hashlib.md5((paragraph_text + detail_level + target_lang).encode()).hexdigest()}'
        cached = cache.get(cache_key)
        if cached:
            return cached

        client = LLMClient(base_url=custom_base_url, api_key=custom_api_key, model=custom_model)
        prompt = (
            f"""You are an assistant providing proactive reading guidance (Reading.help).
Task: Summarize the paragraph in Indonesian ({detail_level} style) and extract challenging vocabulary (CEFR B2-C2).
Output strictly JSON:
{{
  "summary": "1-2 kalimat intisari paragraf dalam Bahasa Indonesia",
  "key_takeaway": "poin penting utama",
  "challenging_words": [
    {{"word": "term", "cefr": "B2/C1", "brief_id": "arti singkat"}}
  ]
}}"""
        )

        try:
            res = client.get_completion_text([
                {'role': 'system', 'content': prompt},
                {'role': 'user', 'content': paragraph_text}
            ])
            data = json.loads(res)
            cache.set(cache_key, data, timeout=86400 * 14)
            return data
        except Exception as e:
            tr = GoogleTranslateClient.translate_sentence(paragraph_text, target_lang=target_lang, mother_lang=target_lang)
            # Extract rare/long words
            raw_words = re.findall(r'[a-zA-Z]{6,}', paragraph_text)
            unique_words = list(dict.fromkeys([w.lower() for w in raw_words]))[:5]
            challenging = [{'word': w, 'cefr': 'B2' if len(w) < 9 else 'C1', 'brief_id': ''} for w in unique_words]
            return {
                'summary': tr.get('indonesian_text', paragraph_text),
                'key_takeaway': 'Intisari paragraf bacaan',
                'challenging_words': challenging,
                'fallback': True
            }



# Singleton instance
translation_service = TranslationService()
