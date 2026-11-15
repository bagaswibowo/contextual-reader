const POS_LABELS = {
  verb: 'kata kerja',
  noun: 'kata benda',
  adjective: 'kata sifat',
  adverb: 'kata keterangan',
  pronoun: 'kata ganti',
  preposition: 'kata depan',
  conjunction: 'kata sambung',
  interjection: 'kata seru',
  determiner: 'kata penentu',
  numeral: 'kata bilangan',
  article: 'kata sandang',
  auxiliary: 'kata bantu',
  'proper noun': 'nama diri',
}

export function posLabel(pos) {
  if (!pos) return ''
  const key = String(pos).toLowerCase().trim()
  return POS_LABELS[key] || String(pos)
}
