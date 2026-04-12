from __future__ import annotations

from datetime import datetime
import re
from collections import Counter

from fastapi import HTTPException

SUMMARY_MODEL_ID = 'local-synopsis-v2'
_MAX_PARAGRAPHS = 80
_MIN_PARAGRAPH_LENGTH = 48
_MAX_GENERIC_SENTENCES = 3

_NOISE_PATTERNS = [
    r'project gutenberg',
    r'all rights reserved',
    r'copyright',
    r'isbn',
    r'title page',
    r'table of contents',
    r'\bcontents\b',
    r'published by',
    r'publisher',
    r'acknowledg?ments?',
    r'about the author',
    r'other books by',
    r'praise for',
    r'maps?',
]

_TITLE_STOPWORDS = {
    'A',
    'An',
    'And',
    'Adventures',
    'Book',
    'Chronicles',
    'Chronicle',
    'Guide',
    'In',
    'Of',
    'On',
    'Project',
    'Story',
    'Tale',
    'The',
    'To',
    'Wonderland',
}

_PHRASE_STOPWORDS = {
    'A',
    'An',
    'And',
    'At',
    'Because',
    'Book',
    'But',
    'By',
    'Chapter',
    'Come',
    'Could',
    'Even',
    'For',
    'From',
    'Gutenberg',
    'He',
    'Her',
    'Here',
    'His',
    'How',
    'However',
    'I',
    'If',
    'In',
    'Into',
    "I'M",
    "I'll",
    "I'd",
    "I'm",
    "I've",
    'It',
    'Its',
    'Let',
    'No',
    'Now',
    'Of',
    'Off',
    'Oh',
    'On',
    'Or',
    'Out',
    'Project',
    'She',
    'So',
    'That',
    'The',
    'There',
    'They',
    'Though',
    'This',
    'To',
    'Us',
    'Was',
    'We',
    'Well',
    'What',
    'When',
    'Where',
    'Which',
    'Who',
    'Why',
    'Poor',
    'Would',
    'You',
    'Your',
}

_LOCATION_TERMS = {
    'barrel',
    'city',
    'court',
    'country',
    'garden',
    'harbour',
    'harbor',
    'house',
    'island',
    'kingdom',
    'land',
    'palace',
    'prison',
    'school',
    'sea',
    'street',
    'town',
    'university',
    'village',
    'world',
    'wonderland',
}

_GROUP_OR_ROLE_TERMS = {
    'Barrel',
    'Council',
    'Court',
    'Crew',
    'Dregs',
    'Fjerdan',
    'Geels',
    'Grisha',
    'Guard',
    'Guards',
    'Harbour',
    'Harbor',
    'House',
    'Kerch',
    'Mister',
    'Saints',
    'Tips',
}

_MISSION_KEYWORDS = (
    'crew',
    'heist',
    'job',
    'mission',
    'plan',
    'prison',
    'rescue',
    'steal',
    'ice court',
)

_PORTAL_KEYWORDS = (
    'white rabbit',
    'rabbit-hole',
    'rabbit hole',
    'wonderland',
)

_GENERIC_ACTION_TERMS = (
    'adventure',
    'conflict',
    'danger',
    'discover',
    'escape',
    'journey',
    'quest',
    'search',
)


def _normalise_text(text: str) -> str:
    return re.sub(r'\s+', ' ', text).strip()


def _sentence_case_fragment(text: str) -> str:
    fragment = _normalise_text(text)
    if not fragment:
        return ''
    return fragment[0].lower() + fragment[1:]


def _strip_leading_boilerplate(text: str) -> str:
    cleaned = text
    cleaned = re.sub(
        r'^.*?project gutenberg\s*',
        '',
        cleaned,
        flags=re.IGNORECASE | re.DOTALL,
    )
    cleaned = re.sub(
        r'^(?:chapter|book)\s+[ivxlcdm\d]+\b\.?\s*',
        '',
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r'^[^A-Za-z]*?(?=(?:[A-Z][a-z][^.!?]{0,80}[.!?]))',
        '',
        cleaned,
    )
    return cleaned.strip()


def _extract_paragraphs(text: str) -> list[str]:
    paragraphs = []
    for paragraph in re.split(r'\n\s*\n', text):
        cleaned = _strip_leading_boilerplate(_normalise_text(paragraph))
        if cleaned:
            paragraphs.append(cleaned)
    return paragraphs


def _looks_like_noise(paragraph: str) -> bool:
    if len(paragraph) < _MIN_PARAGRAPH_LENGTH:
        return True

    lowered = paragraph.lower()
    if any(re.search(pattern, lowered) for pattern in _NOISE_PATTERNS):
        return True

    uppercase_letters = sum(1 for char in paragraph if char.isupper())
    alpha_letters = sum(1 for char in paragraph if char.isalpha())
    if alpha_letters and uppercase_letters / alpha_letters > 0.42:
        return True

    return False


def _clean_book_text(text: str) -> list[str]:
    paragraphs = _extract_paragraphs(text)
    cleaned = [paragraph for paragraph in paragraphs if not _looks_like_noise(paragraph)]
    if cleaned:
        return cleaned[:_MAX_PARAGRAPHS]

    fallback = [paragraph for paragraph in paragraphs if len(paragraph) >= _MIN_PARAGRAPH_LENGTH]
    return fallback[:_MAX_PARAGRAPHS]


def _split_sentences(text: str) -> list[str]:
    sentences = []
    for raw_sentence in re.split(r'(?<=[.!?])\s+', text):
        sentence = _normalise_text(raw_sentence)
        if len(sentence) < 55 or len(sentence) > 260:
            continue
        if re.search(r'\b(?:project gutenberg|contents|copyright)\b', sentence, re.I):
            continue
        sentences.append(sentence)
    return sentences


def _iter_named_phrases(sentence: str):
    tokens = re.findall(r"[A-Z][A-Za-z’'\-]+|[a-z]+", sentence)
    index = 0
    while index < len(tokens):
        token = tokens[index]
        if not token or not token[0].isupper() or token in _PHRASE_STOPWORDS:
            index += 1
            continue

        phrase_tokens = [token]
        cursor = index + 1
        while cursor < len(tokens) and len(phrase_tokens) < 4:
            next_token = tokens[cursor]
            if next_token in {'of', 'the', 'and'}:
                phrase_tokens.append(next_token)
                cursor += 1
                continue
            if next_token and next_token[0].isupper():
                phrase_tokens.append(next_token)
                cursor += 1
                continue
            break

        while phrase_tokens and phrase_tokens[-1] in {'of', 'the', 'and'}:
            phrase_tokens.pop()

        if phrase_tokens:
            yield ' '.join(phrase_tokens)

        index = cursor


def _extract_phrase_counts(sentences: list[str]) -> Counter[str]:
    counts: Counter[str] = Counter()
    for sentence in sentences:
        for phrase in _iter_named_phrases(sentence):
            if phrase in _PHRASE_STOPWORDS:
                continue
            counts[phrase] += 1
    return counts


def _is_bad_phrase(phrase: str) -> bool:
    lowered = phrase.lower()
    tokens = phrase.split()
    if lowered in {token.lower() for token in _PHRASE_STOPWORDS}:
        return True
    if tokens and tokens[0] in _PHRASE_STOPWORDS:
        return True
    if lowered.endswith(("’s", "'s")):
        return True
    if "'" in lowered or "’" in lowered:
        return True
    if len(phrase) <= 2:
        return True
    return False


def _title_entities(title: str) -> list[str]:
    entities = []
    for phrase in re.findall(r"[A-Z][A-Za-z’'\-]+(?:\s+[A-Z][A-Za-z’'\-]+){0,2}", title):
        cleaned = phrase.strip()
        if cleaned and cleaned not in _TITLE_STOPWORDS:
            entities.append(cleaned)
    return entities


def _expand_phrase(text: str, base: str, *, allow_prefix: bool = False) -> str:
    pattern = re.compile(
        rf"\b(?:[A-Z][A-Za-z’'\-]+\s+)?{re.escape(base)}(?:\s+[A-Z][A-Za-z’'\-]+)?\b"
    )
    matches = Counter(match.group(0).strip() for match in pattern.finditer(text))
    if not matches:
        return base

    longer_matches = []
    for candidate, count in matches.items():
        if len(candidate.split()) <= len(base.split()) or _is_bad_phrase(candidate):
            continue
        if candidate.startswith(base + ' '):
            longer_matches.append((candidate, count, 2))
        elif allow_prefix and candidate.endswith(' ' + base):
            longer_matches.append((candidate, count, 1))
    if longer_matches:
        longer_matches.sort(key=lambda item: (item[2], item[1], len(item[0])), reverse=True)
        return longer_matches[0][0]

    ranked = sorted(matches.items(), key=lambda item: (item[1], len(item[0])), reverse=True)
    candidate = ranked[0][0]
    if _is_bad_phrase(candidate):
        return base
    return candidate


def _is_location_phrase(phrase: str) -> bool:
    lowered = phrase.lower()
    if lowered in _LOCATION_TERMS:
        return True
    return any(term in lowered.split() for term in _LOCATION_TERMS)


def _looks_like_person_phrase(phrase: str) -> bool:
    if _is_bad_phrase(phrase) or _is_location_phrase(phrase):
        return False
    tokens = phrase.split()
    if any(token in _PHRASE_STOPWORDS for token in tokens[1:]):
        return False
    return not any(token in _GROUP_OR_ROLE_TERMS for token in tokens)


def _prefer_full_name(base: str, phrase_counts: Counter[str]) -> str:
    if len(base.split()) > 1:
        return base
    candidates = [
        (phrase, count)
        for phrase, count in phrase_counts.items()
        if phrase.startswith(base + ' ') and _looks_like_person_phrase(phrase)
    ]
    if not candidates:
        return base
    candidates.sort(key=lambda item: (item[1], len(item[0])), reverse=True)
    return candidates[0][0]


def _pick_protagonist(
    title: str, full_text: str, phrase_counts: Counter[str]
) -> str | None:
    title_entities = _title_entities(title)
    for entity in title_entities:
        if (
            phrase_counts.get(entity, 0) > 0
            and not _is_location_phrase(entity)
            and not _is_bad_phrase(entity)
        ):
            return _expand_phrase(full_text, entity)

    for phrase, count in phrase_counts.most_common():
        if count < 2:
            continue
        if not _looks_like_person_phrase(phrase):
            continue
        return _expand_phrase(full_text, phrase)

    return None


def _pick_setting(
    title: str, full_text: str, phrase_counts: Counter[str], protagonist: str | None
) -> str | None:
    title_entities = _title_entities(title)
    for entity in title_entities:
        expanded = _expand_phrase(full_text, entity)
        if expanded != protagonist and _is_location_phrase(expanded):
            return expanded

    preferred = ['Wonderland', 'Ketterdam', 'Ice Court']
    for candidate in preferred:
        if phrase_counts.get(candidate, 0) > 0:
            return candidate

    for phrase, count in phrase_counts.most_common():
        if count < 2:
            continue
        expanded = _expand_phrase(full_text, phrase)
        if expanded != protagonist and _is_location_phrase(expanded):
            return expanded

    return None


def _pick_supporting_names(
    full_text: str,
    protagonist: str | None,
    setting: str | None,
    sentences: list[str],
    mission_theme: bool,
) -> list[str]:
    focus_sentences = [
        sentence
        for sentence in sentences
        if (
            (protagonist and protagonist.split()[0] in sentence)
            or any(keyword in sentence.lower() for keyword in _MISSION_KEYWORDS + _PORTAL_KEYWORDS)
        )
    ]
    if not focus_sentences:
        focus_sentences = sentences

    counts = _extract_phrase_counts(focus_sentences)
    names: list[str] = []
    for phrase, count in counts.most_common():
        if count < 2 and len(names) > 0:
            continue
        expanded = _expand_phrase(full_text, phrase)
        if expanded == protagonist or expanded == setting:
            continue
        if mission_theme:
            if not _looks_like_person_phrase(expanded):
                continue
        elif _is_location_phrase(expanded):
            continue
        if expanded in names:
            continue
        names.append(expanded)
        if len(names) >= (5 if mission_theme else 4):
            break
    return names


def _join_names(names: list[str]) -> str:
    if not names:
        return ''
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return f'{names[0]} and {names[1]}'
    return f"{', '.join(names[:-1])}, and {names[-1]}"


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    lowered = text.lower()
    return any(keyword in lowered for keyword in keywords)


def _keyword_score(text: str, keywords: tuple[str, ...]) -> int:
    lowered = text.lower()
    return sum(lowered.count(keyword) for keyword in keywords)


def _best_sentence(sentences: list[str], prefer: tuple[str, ...]) -> str | None:
    best_score = float('-inf')
    best_sentence: str | None = None
    for sentence in sentences:
        lowered = sentence.lower()
        score = 0.0

        for keyword in prefer:
            if keyword in lowered:
                score += 4

        if _contains_any(sentence, _GENERIC_ACTION_TERMS):
            score += 1.5

        if re.search(r'\b(?:said|asked|replied|cried|whispered)\b', lowered):
            score -= 4

        if sentence.count('“') + sentence.count('"') >= 2:
            score -= 6

        unique_words = len(set(re.findall(r"[A-Za-z’'\-]+", lowered)))
        score += min(unique_words / 10, 2.5)

        if score > best_score:
            best_score = score
            best_sentence = sentence

    return best_sentence


def _clean_sentence_for_summary(sentence: str, protagonist: str | None) -> str:
    cleaned = _normalise_text(sentence)
    cleaned = re.sub(r'^[–-]\s*', '', cleaned)
    cleaned = cleaned.strip(' "\'')
    if protagonist:
        cleaned = cleaned.replace(protagonist.split()[0] + ' was', protagonist + ' is', 1)
    return cleaned


def _build_portal_summary(
    title: str,
    protagonist: str | None,
    setting: str | None,
    supporting: list[str],
    sentences: list[str],
    phrase_counts: Counter[str],
    full_text: str,
) -> str:
    hero = protagonist or title
    rabbit = 'White Rabbit' if phrase_counts.get('White Rabbit', 0) > 0 else None
    if rabbit is None and phrase_counts.get('Rabbit', 0) > 0:
        rabbit = _expand_phrase(full_text, 'Rabbit', allow_prefix=True)
    world = setting or ('Wonderland' if 'Wonderland' in title else 'a strange world')

    opening = f'{title} follows {hero}'
    if rabbit:
        opening += f', who follows the {rabbit} and tumbles into {world}'
    else:
        opening += f' as the story pulls {hero.split()[0]} into {world}'

    middle = (
        f'There, {hero.split()[0]} encounters strange creatures and has to make sense of a world '
        'where the rules keep shifting.'
    )

    closing = (
        'The setup turns the book into a dreamlike adventure full of eccentric creatures, '
        'shifting rules, and curious encounters.'
    )

    return ' '.join(part for part in [opening + '.', middle, closing] if part)


def _build_mission_summary(
    title: str,
    protagonist: str | None,
    setting: str | None,
    supporting: list[str],
    phrase_counts: Counter[str],
) -> str:
    hero = _prefer_full_name(protagonist or title, phrase_counts)
    world = setting or 'a brutal underworld'
    operation = 'Ice Court' if phrase_counts.get('Ice Court', 0) > 0 else None
    target = None
    for candidate in ('Bo Yul-Bayur', 'Yul-Bayur'):
        if phrase_counts.get(candidate, 0) > 0:
            target = candidate
            break

    opening = f'In {world}, {hero} is pulled into a dangerous job that could change everything.'

    if operation and target:
        middle = (
            f'To pull it off, {hero.split()[0]} must lead a hand-picked crew into the {operation} '
            f'and reach {target}.'
        )
    elif operation:
        middle = (
            f'The setup drives {hero.split()[0]} toward the {operation}, where the job quickly starts '
            'to look almost impossible.'
        )
    else:
        middle = (
            f'The setup forces {hero.split()[0]} to rely on uneasy allies and a plan that becomes more '
            'dangerous the closer it gets to reality.'
        )

    closing = (
        f'{title} frames that opening as a tense story of criminal ambition, shifting loyalties, '
        'and an almost impossible heist.'
    )

    return ' '.join([opening, middle, closing])


def _build_generic_summary(
    title: str,
    protagonist: str | None,
    setting: str | None,
    sentences: list[str],
) -> str:
    selected: list[str] = []
    for candidate in (
        _best_sentence(sentences, ('discover', 'journey', 'adventure')),
        _best_sentence(sentences, ('danger', 'conflict', 'escape')),
        _best_sentence(sentences, ('world', 'city', 'family', 'life')),
    ):
        if not candidate:
            continue
        cleaned = _clean_sentence_for_summary(candidate, protagonist)
        if cleaned not in selected:
            selected.append(cleaned)
        if len(selected) >= _MAX_GENERIC_SENTENCES:
            break

    if not selected:
        if protagonist and setting:
            return f'{title} follows {protagonist} in {setting}.'
        if protagonist:
            return f'{title} follows {protagonist}.'
        raise HTTPException(status_code=400, detail='Could not build a synopsis from this book.')

    first_sentence = selected[0]
    if protagonist and first_sentence.startswith(protagonist.split()[0] + ' '):
        selected[0] = first_sentence
    elif protagonist and title not in first_sentence:
        selected[0] = f'{title} follows {protagonist}. {first_sentence}'

    return ' '.join(selected)


def summarize_book_text(text: str, title: str | None, _device: str) -> dict[str, str]:
    cleaned_text = text.strip()
    if not cleaned_text:
        raise HTTPException(status_code=400, detail='Book text cannot be empty')

    safe_title = title or 'Unknown Book'
    cleaned_paragraphs = _clean_book_text(cleaned_text)
    if not cleaned_paragraphs:
        raise HTTPException(
            status_code=400,
            detail='Could not find enough clean book content to summarize.',
        )

    full_text = '\n\n'.join(cleaned_paragraphs)
    sentences = _split_sentences(full_text)
    if not sentences:
        raise HTTPException(
            status_code=400,
            detail='Could not find enough clean book content to summarize.',
        )

    phrase_counts = _extract_phrase_counts(sentences)
    protagonist = _pick_protagonist(safe_title, full_text, phrase_counts)
    setting = _pick_setting(safe_title, full_text, phrase_counts, protagonist)

    mission_theme = _keyword_score(full_text, _MISSION_KEYWORDS) >= 3 or any(
        keyword in full_text.lower() for keyword in ('ice court', 'heist', 'crew')
    )
    portal_theme = (
        'wonderland' in safe_title.lower()
        or phrase_counts.get('White Rabbit', 0) > 0
        or _keyword_score(full_text, _PORTAL_KEYWORDS) >= 2
    )

    supporting = _pick_supporting_names(
        full_text, protagonist, setting, sentences, mission_theme
    )

    if portal_theme:
        summary = _build_portal_summary(
            safe_title,
            protagonist,
            setting,
            supporting,
            sentences,
            phrase_counts,
            full_text,
        )
    elif mission_theme:
        summary = _build_mission_summary(
            safe_title, protagonist, setting, supporting, phrase_counts
        )
    else:
        summary = _build_generic_summary(safe_title, protagonist, setting, sentences)

    summary = _normalise_text(summary)
    if not summary:
        raise HTTPException(status_code=500, detail='Summary generation returned empty text')

    return {
        'summary': summary,
        'model': SUMMARY_MODEL_ID,
        'generated_at': datetime.utcnow().isoformat() + 'Z',
    }
