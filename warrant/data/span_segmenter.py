import re
import unicodedata
from warrant.core.schema import EvidenceSpan


def slugify(text: str) -> str:
    """simple ascii slugifier for span id generation"""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[-\s]+", "_", text)[:40]


def split_sentences_robust(text: str) -> list[str]:
    """regex sentence splittng with protection for common titles and abbreviations"""
    text = text.strip()
    if not text:
        return []

    # protect common abbreviations from splitting
    protected = text
    abbrevs = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Sr.", "Jr.", "vs.", "e.g.", "i.e.", "U.S.", "U.K.", "St."]
    placeholders = {}
    for idx, abbrev in enumerate(abbrevs):
        token = f"__ABBR_{idx}__"
        placeholders[token] = abbrev
        protected = protected.replace(abbrev, token)

    # split on terminal punctuation followed by whitespace and capital letter
    raw_sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z0-9"\'\(\[])', protected)

    sentences = []
    for s in raw_sentences:
        s = s.strip()
        if not s:
            continue
        # restore abbreviations
        for token, original in placeholders.items():
            s = s.replace(token, original)
        sentences.append(s)

    return sentences


def segment_document_into_spans(
    article_title: str,
    text: str,
    section_title: str = "Lead"
) -> list[EvidenceSpan]:
    """segments document text into discrete evidence spans with formatted premise identifiers"""
    sentences = split_sentences_robust(text)
    slug = slugify(article_title) or "doc"
    spans = []

    for idx, sent in enumerate(sentences):
        span_id = f"span_{slug}_{idx:03d}"
        spans.append(
            EvidenceSpan(
                span_id=span_id,
                article_title=article_title,
                section_title=section_title,
                sentence_idx=idx,
                text=sent
            )
        )

    return spans
