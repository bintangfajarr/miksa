-- Miksa — grammar rule catalogue (starter set)
--
-- These are the eight rules named in SDD §6.1. The full ~60-rule catalogue is
-- M3 work; this subset exists so M0 has real rows to render and M2 has a real
-- enum to classify into.
--
-- Explanations are written in Indonesian because that is what the learner
-- reads (SDD §6.3). Keep them one or two sentences: a correction card that
-- needs scrolling does not get read.

insert into grammar_rules
  (id, title_en, title_id, cefr, explanation_id, example_wrong, example_right)
values
  ('article-indefinite',
   'Indefinite article (a / an)',
   'Artikel tak tentu (a / an)',
   'A2',
   'Kata benda tunggal yang bisa dihitung hampir selalu butuh "a" atau "an" di depannya. Bahasa Indonesia tidak punya ini, jadi gampang kelewat.',
   'I need roadmap for this project.',
   'I need a roadmap for this project.'),

  ('question-embedded',
   'Embedded questions',
   'Pertanyaan di dalam kalimat',
   'B1',
   'Kalau pertanyaan jadi bagian dari kalimat lain, urutannya kembali normal (subjek dulu, baru kata kerja) — tidak dibalik seperti pertanyaan langsung.',
   'Do you know what should I do?',
   'Do you know what I should do?'),

  ('tense-present-perfect',
   'Present perfect',
   'Present perfect',
   'B1',
   'Untuk sesuatu yang sudah selesai tapi masih relevan sekarang, pakai have/has + verb-3. "Udah" dalam bahasa Indonesia sering diterjemahkan salah jadi present simple.',
   'I already eat lunch.',
   'I have already eaten lunch.'),

  ('agreement-third-person-s',
   'Third person -s',
   'Akhiran -s untuk orang ketiga',
   'A2',
   'Subjek he, she, it, atau satu orang/benda: kata kerjanya tambah -s. Bahasa Indonesia tidak mengubah kata kerja, jadi ini murni kebiasaan baru.',
   'He go to campus every morning.',
   'He goes to campus every morning.'),

  ('punct-comma-splice',
   'Comma splice',
   'Dua kalimat disambung koma',
   'B1',
   'Dua kalimat utuh tidak bisa disambung hanya dengan koma. Pakai titik, atau tambahkan and/but/so.',
   'I tried it, it did not work.',
   'I tried it, but it did not work.'),

  ('prep-collocation',
   'Verb + preposition',
   'Kata kerja + kata depan',
   'B1',
   'Sebagian kata kerja Inggris tidak butuh kata depan walaupun padanan Indonesianya pakai. "Discuss about" salah karena discuss sudah berarti "mendiskusikan tentang".',
   'Let us discuss about the schedule.',
   'Let us discuss the schedule.'),

  ('conditional-third',
   'Third conditional',
   'Pengandaian tipe ketiga',
   'B2',
   'Untuk menyesali sesuatu di masa lalu yang tidak terjadi: If + had + verb-3, lalu would have + verb-3.',
   'If I knew, I would tell you.',
   'If I had known, I would have told you.'),

  ('word-order-adverb',
   'Adverb placement',
   'Letak kata keterangan',
   'B1',
   'Kata keterangan frekuensi (always, never, often, usually) diletakkan sebelum kata kerja utama, bukan sesudahnya.',
   'I go always to the library on Friday.',
   'I always go to the library on Friday.')

on conflict (id) do update set
  title_en       = excluded.title_en,
  title_id       = excluded.title_id,
  cefr           = excluded.cefr,
  explanation_id = excluded.explanation_id,
  example_wrong  = excluded.example_wrong,
  example_right  = excluded.example_right;
