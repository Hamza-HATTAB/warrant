from warrant.data.span_segmenter import split_sentences_robust, segment_document_into_spans


def test_split_sentences_robust_abbreviations():
    raw_text = "Dr. Nolan moved to the U.S. in 2001. He directed Inception in 2010! It won 4 Oscars."
    sentences = split_sentences_robust(raw_text)
    assert len(sentences) == 3
    assert sentences[0] == "Dr. Nolan moved to the U.S. in 2001."
    assert sentences[1] == "He directed Inception in 2010!"
    assert sentences[2] == "It won 4 Oscars."


def test_segment_document_into_spans_ids():
    title = "Christopher Nolan"
    body = "Christopher Nolan is a British-American filmmaker. Known for his Hollywood blockbusters, his films have grossed over $6 billion."
    spans = segment_document_into_spans(title, body)
    
    assert len(spans) == 2
    assert spans[0].span_id == "span_christopher_nolan_000"
    assert spans[1].span_id == "span_christopher_nolan_001"
    assert spans[0].article_title == "Christopher Nolan"
    assert "[Title: Christopher Nolan]" in spans[0].formatted_premise
