-- Miksa — grammar rule catalogue
--
-- 60 rules covering A2–B2. This is the fixed taxonomy from SDD §6.1: the model
-- classifies every correction into one of these ids, or into null.
--
-- Why a fixed catalogue and not free-form labels: ask a model to name the rule
-- it corrected and within a week you have "Article usage", "Articles (a/an)",
-- "Missing article" and "Indefinite articles" as four unlinkable rows for one
-- rule. Then "how often do I break this" is unanswerable, and every downstream
-- feature — progress charts, spaced repetition, level-up tests — has nothing to
-- stand on.
--
-- Selection bias is deliberate. These are errors *Indonesian speakers* make,
-- chosen from interference patterns between the two languages: no articles in
-- Indonesian, no verb inflection, no plural marking, no tense morphology,
-- different preposition collocations. A generic ESL catalogue would waste half
-- its rows on errors this audience rarely makes.
--
-- Explanations are in Indonesian (SDD §6.3), kept to one or two sentences. A
-- correction card that needs scrolling does not get read.
--
-- Ids are namespaced by category so the collection screen can group on prefix:
--   article- agreement- tense- verb- noun- pron- prep- adj- adv-
--   word-order- conditional- punct- spelling- style- question-

insert into grammar_rules
  (id, title_en, title_id, cefr, explanation_id, example_wrong, example_right)
values

-- === ARTICLES =============================================================
-- Indonesian has no articles at all, so this whole category is invisible to a
-- native speaker until someone points it out.
('article-indefinite',
 'Indefinite article (a / an)',
 'Artikel tak tentu (a / an)',
 'A2',
 'Kata benda tunggal yang bisa dihitung hampir selalu butuh "a" atau "an" di depannya. Bahasa Indonesia tidak punya ini, jadi gampang kelewat.',
 'I need roadmap for this project.',
 'I need a roadmap for this project.'),

('article-definite',
 'Definite article (the)',
 'Artikel tentu (the)',
 'A2',
 'Pakai "the" kalau lawan bicara sudah tahu benda mana yang kamu maksud — misalnya sudah disebut sebelumnya, atau cuma ada satu.',
 'I went to library near campus.',
 'I went to the library near campus.'),

('article-zero',
 'No article needed',
 'Tidak perlu artikel',
 'B1',
 'Kata benda tak terhitung dan jamak yang bersifat umum tidak pakai artikel. "The information" hanya kalau informasi tertentu.',
 'I need the information about the scholarships.',
 'I need information about scholarships.'),

('article-an-vowel',
 'A vs an',
 'Pilih a atau an',
 'A2',
 'Pakai "an" kalau kata berikutnya dibaca dengan bunyi vokal, bukan dilihat dari hurufnya. "An hour" (bunyi /aw/), tapi "a university" (bunyi /yu/).',
 'It took a hour to finish.',
 'It took an hour to finish.'),

-- === SUBJECT–VERB AGREEMENT ===============================================
-- Indonesian verbs never change for person or number. Every rule here is a
-- habit that has to be built from zero.
('agreement-third-person-s',
 'Third person -s',
 'Akhiran -s untuk orang ketiga',
 'A2',
 'Subjek he, she, it, atau satu orang/benda: kata kerjanya tambah -s. Bahasa Indonesia tidak mengubah kata kerja, jadi ini murni kebiasaan baru.',
 'He go to campus every morning.',
 'He goes to campus every morning.'),

('agreement-be',
 'Forms of "be"',
 'Bentuk to be (am/is/are)',
 'A2',
 'Sesuaikan to be dengan subjeknya: I am, he/she/it is, you/we/they are.',
 'They is my classmates.',
 'They are my classmates.'),

('agreement-there-is-are',
 'There is / there are',
 'There is atau there are',
 'A2',
 'Pakai "there is" untuk satu benda, "there are" untuk lebih dari satu.',
 'There is many people in the canteen.',
 'There are many people in the canteen.'),

('agreement-quantifier',
 'Agreement after quantifiers',
 'Kesesuaian setelah kata jumlah',
 'B1',
 '"Everyone", "everybody", dan "each" dianggap tunggal walaupun maknanya banyak orang.',
 'Everyone in my group have submitted.',
 'Everyone in my group has submitted.'),

-- === TENSES ===============================================================
-- Indonesian marks time with adverbs (sudah, sedang, akan), not by changing
-- the verb. Learners translate the adverb and leave the verb alone.
('tense-present-simple-habit',
 'Present simple for habits',
 'Present simple untuk kebiasaan',
 'A2',
 'Untuk kebiasaan atau fakta umum, pakai present simple — bukan present continuous.',
 'I am going to campus every Monday.',
 'I go to campus every Monday.'),

('tense-present-continuous',
 'Present continuous for now',
 'Present continuous untuk sekarang',
 'A2',
 'Untuk sesuatu yang sedang berlangsung saat ini, pakai am/is/are + verb-ing.',
 'Sorry, I eat lunch right now.',
 'Sorry, I am eating lunch right now.'),

('tense-past-simple',
 'Past simple',
 'Past simple',
 'A2',
 'Kejadian yang sudah selesai di waktu tertentu di masa lalu pakai bentuk lampau. Kata seperti "yesterday" atau "last week" menandakan ini.',
 'Yesterday I go to the seminar.',
 'Yesterday I went to the seminar.'),

('tense-present-perfect',
 'Present perfect',
 'Present perfect',
 'B1',
 'Untuk sesuatu yang sudah selesai tapi masih relevan sekarang, pakai have/has + verb-3. "Udah" sering diterjemahkan salah jadi present simple.',
 'I already eat lunch.',
 'I have already eaten lunch.'),

('tense-present-perfect-vs-past',
 'Present perfect vs past simple',
 'Present perfect atau past simple',
 'B1',
 'Kalau waktunya disebut jelas (yesterday, last year), pakai past simple. Present perfect untuk waktu yang tidak spesifik.',
 'I have finished it yesterday.',
 'I finished it yesterday.'),

('tense-past-continuous',
 'Past continuous',
 'Past continuous',
 'B1',
 'Untuk kejadian yang sedang berlangsung ketika hal lain terjadi, pakai was/were + verb-ing.',
 'I studied when she called me.',
 'I was studying when she called me.'),

('tense-future-will-going-to',
 'Will vs going to',
 'Will atau going to',
 'B1',
 'Pakai "going to" untuk rencana yang sudah dipikirkan, "will" untuk keputusan mendadak atau perkiraan.',
 'I will submit my thesis next month, I already planned it.',
 'I am going to submit my thesis next month, I already planned it.'),

('tense-consistency',
 'Tense consistency',
 'Konsistensi waktu',
 'B1',
 'Dalam satu cerita, jangan berpindah-pindah antara masa lalu dan sekarang tanpa alasan.',
 'I went to the lab and I see my supervisor there.',
 'I went to the lab and I saw my supervisor there.'),

('tense-past-perfect',
 'Past perfect',
 'Past perfect',
 'B2',
 'Untuk kejadian yang terjadi lebih dulu dari kejadian lampau lainnya, pakai had + verb-3.',
 'When I arrived, the class already started.',
 'When I arrived, the class had already started.'),

-- === VERB FORMS ===========================================================
('verb-modal-bare-infinitive',
 'Verb after a modal',
 'Kata kerja setelah modal',
 'A2',
 'Setelah can, will, must, should, dan modal lain, kata kerjanya bentuk dasar tanpa to dan tanpa -s.',
 'She can speaks three languages.',
 'She can speak three languages.'),

('verb-to-infinitive',
 'Verb + to + infinitive',
 'Kata kerja + to + infinitive',
 'B1',
 'Kata kerja seperti want, need, decide, plan, hope diikuti "to" + kata kerja dasar.',
 'I want improve my English.',
 'I want to improve my English.'),

('verb-gerund-after-preposition',
 'Gerund after a preposition',
 'Verb-ing setelah kata depan',
 'B1',
 'Setelah kata depan (in, on, at, about, of, for), kata kerja selalu berbentuk -ing.',
 'I am interested in learn more about it.',
 'I am interested in learning more about it.'),

('verb-gerund-vs-infinitive',
 'Gerund vs infinitive',
 'Verb-ing atau to + verb',
 'B2',
 'Sebagian kata kerja hanya menerima -ing (enjoy, avoid, finish, suggest), sebagian hanya "to" (want, decide, hope).',
 'I enjoy to read English articles.',
 'I enjoy reading English articles.'),

('verb-passive',
 'Passive voice',
 'Kalimat pasif',
 'B1',
 'Kalimat pasif dibentuk dengan to be + verb-3. Bahasa Indonesia memakai awalan di-, jadi strukturnya terasa berbeda.',
 'The report was submit last week.',
 'The report was submitted last week.'),

('verb-irregular-past',
 'Irregular past forms',
 'Bentuk lampau tidak beraturan',
 'A2',
 'Sebagian kata kerja tidak memakai -ed: go→went, buy→bought, teach→taught. Ini harus dihafal.',
 'I buyed a new notebook.',
 'I bought a new notebook.'),

('verb-missing-be',
 'Missing "be" before adjective',
 'To be yang hilang',
 'A2',
 'Bahasa Indonesia tidak butuh kata kerja di "Saya lapar", tapi bahasa Inggris wajib pakai am/is/are.',
 'I very tired today.',
 'I am very tired today.'),

('verb-double-marking',
 'Double past marking',
 'Penanda lampau ganda',
 'B1',
 'Kalau sudah pakai "did", kata kerjanya kembali ke bentuk dasar.',
 'I did not went to the class.',
 'I did not go to the class.'),

-- === NOUNS ================================================================
-- Indonesian marks plural by repetition (buku-buku) or not at all.
('noun-plural-s',
 'Plural -s',
 'Akhiran -s untuk jamak',
 'A2',
 'Kata benda lebih dari satu perlu -s. Bahasa Indonesia tidak wajib menandai jamak, jadi ini sering kelewat.',
 'I have three book about design.',
 'I have three books about design.'),

('noun-uncountable',
 'Uncountable nouns',
 'Kata benda tak terhitung',
 'B1',
 'Kata seperti information, advice, research, homework tidak punya bentuk jamak dan tidak pakai "a".',
 'She gave me some good advices.',
 'She gave me some good advice.'),

('noun-plural-irregular',
 'Irregular plurals',
 'Jamak tidak beraturan',
 'A2',
 'Sebagian kata benda berubah bentuk: person→people, child→children, analysis→analyses.',
 'There were many childs at the event.',
 'There were many children at the event.'),

('noun-possessive',
 'Possessive apostrophe',
 'Kepemilikan dengan apostrof',
 'A2',
 'Kepemilikan ditandai dengan ''s, bukan dengan urutan kata seperti bahasa Indonesia.',
 'This is the book of my friend.',
 'This is my friend''s book.'),

('noun-countable-quantifier',
 'Much / many / few / little',
 'Much, many, few, little',
 'B1',
 'Pakai many dan few untuk yang bisa dihitung, much dan little untuk yang tidak bisa dihitung.',
 'I do not have much friends here.',
 'I do not have many friends here.'),

-- === PRONOUNS =============================================================
('pron-subject-object',
 'Subject vs object pronouns',
 'Kata ganti subjek dan objek',
 'A2',
 'Subjek: I, he, she, we, they. Objek: me, him, her, us, them.',
 'She gave the book to I.',
 'She gave the book to me.'),

('pron-possessive',
 'Possessive pronouns',
 'Kata ganti kepemilikan',
 'A2',
 'My, your, his, her, our, their diikuti kata benda. Mine, yours, his, hers, ours, theirs berdiri sendiri.',
 'That laptop is my.',
 'That laptop is mine.'),

('pron-it-subject',
 'Dummy subject "it"',
 'Subjek "it" yang wajib',
 'B1',
 'Bahasa Inggris wajib punya subjek. Kalimat tentang cuaca, waktu, atau jarak memakai "it" walaupun tidak menunjuk apa pun.',
 'Is raining outside.',
 'It is raining outside.'),

('pron-relative',
 'Relative pronouns',
 'Kata penghubung who/which/that',
 'B1',
 'Pakai "who" untuk orang, "which" untuk benda, "that" untuk keduanya.',
 'The lecturer which taught us is very kind.',
 'The lecturer who taught us is very kind.'),

('pron-reflexive',
 'Reflexive pronouns',
 'Kata ganti refleksif',
 'B1',
 'Pakai myself, yourself, himself kalau subjek dan objeknya orang yang sama.',
 'I taught me how to use it.',
 'I taught myself how to use it.'),

-- === PREPOSITIONS =========================================================
-- Prepositions map badly between the two languages; this is one of the most
-- frequent error categories for Indonesian speakers.
('prep-time',
 'Prepositions of time',
 'Kata depan waktu',
 'A2',
 'Pakai "at" untuk jam, "on" untuk hari dan tanggal, "in" untuk bulan dan tahun.',
 'The class starts in 8 AM.',
 'The class starts at 8 AM.'),

('prep-place',
 'Prepositions of place',
 'Kata depan tempat',
 'A2',
 'Pakai "at" untuk titik lokasi, "in" untuk ruang tertutup atau area, "on" untuk permukaan.',
 'I am waiting in the bus stop.',
 'I am waiting at the bus stop.'),

('prep-collocation',
 'Verb + preposition',
 'Kata kerja + kata depan',
 'B1',
 'Sebagian kata kerja Inggris tidak butuh kata depan walaupun padanan Indonesianya pakai. "Discuss about" salah karena discuss sudah berarti "mendiskusikan tentang".',
 'Let us discuss about the schedule.',
 'Let us discuss the schedule.'),

('prep-adjective',
 'Adjective + preposition',
 'Kata sifat + kata depan',
 'B1',
 'Kata sifat tertentu selalu berpasangan dengan kata depan tertentu: interested in, good at, afraid of, responsible for.',
 'I am good in mathematics.',
 'I am good at mathematics.'),

('prep-missing',
 'Missing preposition',
 'Kata depan yang hilang',
 'B1',
 'Sebagian kata kerja Inggris justru butuh kata depan yang tidak ada padanannya dalam bahasa Indonesia: listen to, wait for, look at.',
 'I am waiting my friend.',
 'I am waiting for my friend.'),

('prep-extra',
 'Unnecessary preposition',
 'Kata depan berlebih',
 'B1',
 'Kata kerja seperti enter, answer, call, join, contact langsung diikuti objek tanpa kata depan.',
 'She entered into the room quietly.',
 'She entered the room quietly.'),

-- === ADJECTIVES ===========================================================
('adj-comparative',
 'Comparative form',
 'Bentuk perbandingan',
 'A2',
 'Kata sifat pendek tambah -er, kata sifat panjang pakai "more". Jangan dipakai bersamaan.',
 'This method is more easier than that one.',
 'This method is easier than that one.'),

('adj-superlative',
 'Superlative form',
 'Bentuk paling',
 'A2',
 'Bentuk superlatif pakai "the" + -est, atau "the most" untuk kata sifat panjang.',
 'It is most difficult subject this semester.',
 'It is the most difficult subject this semester.'),

('adj-ed-ing',
 '-ed vs -ing adjectives',
 'Kata sifat -ed dan -ing',
 'B1',
 '-ed menggambarkan perasaan orang (I am bored), -ing menggambarkan sifat sesuatu (the class is boring).',
 'I am very boring with this topic.',
 'I am very bored with this topic.'),

('adj-order',
 'Adjective order',
 'Urutan kata sifat',
 'B2',
 'Kalau ada beberapa kata sifat, urutannya: pendapat, ukuran, umur, bentuk, warna, asal, bahan.',
 'She bought a leather black nice bag.',
 'She bought a nice black leather bag.'),

('adj-noun-order',
 'Adjective before noun',
 'Kata sifat sebelum kata benda',
 'A2',
 'Dalam bahasa Inggris kata sifat diletakkan sebelum kata benda — kebalikan dari bahasa Indonesia.',
 'I bought a book new.',
 'I bought a new book.'),

-- === ADVERBS ==============================================================
('adv-frequency-position',
 'Adverb of frequency position',
 'Letak kata keterangan frekuensi',
 'B1',
 'Kata keterangan frekuensi (always, never, often, usually) diletakkan sebelum kata kerja utama, bukan sesudahnya.',
 'I go always to the library on Friday.',
 'I always go to the library on Friday.'),

('adv-vs-adjective',
 'Adverb vs adjective',
 'Kata keterangan atau kata sifat',
 'B1',
 'Untuk menerangkan cara melakukan sesuatu, pakai kata keterangan (-ly), bukan kata sifat.',
 'She speaks English very good.',
 'She speaks English very well.'),

('adv-very-too',
 'Very vs too',
 'Very atau too',
 'B1',
 '"Very" hanya menguatkan, "too" berarti berlebihan sampai jadi masalah.',
 'The material is too interesting, I enjoyed it.',
 'The material is very interesting, I enjoyed it.'),

-- === WORD ORDER ===========================================================
('word-order-question',
 'Question word order',
 'Urutan kata dalam pertanyaan',
 'A2',
 'Pertanyaan bahasa Inggris membalik urutan atau menambah do/does/did. Bahasa Indonesia cukup mengubah intonasi.',
 'You already finished the assignment?',
 'Have you already finished the assignment?'),

('question-embedded',
 'Embedded questions',
 'Pertanyaan di dalam kalimat',
 'B1',
 'Kalau pertanyaan jadi bagian dari kalimat lain, urutannya kembali normal (subjek dulu, baru kata kerja) — tidak dibalik seperti pertanyaan langsung.',
 'Do you know what should I do?',
 'Do you know what I should do?'),

('question-tag',
 'Question tags',
 'Pertanyaan penegas',
 'B2',
 'Tag question mengikuti kalimatnya: kalimat positif diikuti tag negatif, dan sebaliknya.',
 'You are coming tomorrow, isn''t it?',
 'You are coming tomorrow, aren''t you?'),

('word-order-object',
 'Object placement',
 'Letak objek',
 'B1',
 'Objek diletakkan tepat setelah kata kerja, jangan disisipi kata keterangan.',
 'I like very much this song.',
 'I like this song very much.'),

('word-order-indirect-object',
 'Indirect object order',
 'Urutan objek tak langsung',
 'B1',
 'Pola: give someone something, atau give something to someone.',
 'She gave to me the document.',
 'She gave me the document.'),

-- === CONDITIONALS & CLAUSES ===============================================
('conditional-first',
 'First conditional',
 'Pengandaian tipe pertama',
 'B1',
 'Untuk kemungkinan nyata di masa depan: If + present simple, lalu will + kata kerja dasar. Setelah "if" jangan pakai will.',
 'If it will rain, I will stay home.',
 'If it rains, I will stay home.'),

('conditional-second',
 'Second conditional',
 'Pengandaian tipe kedua',
 'B2',
 'Untuk situasi yang tidak nyata sekarang: If + past simple, lalu would + kata kerja dasar.',
 'If I have more time, I would join the competition.',
 'If I had more time, I would join the competition.'),

('conditional-third',
 'Third conditional',
 'Pengandaian tipe ketiga',
 'B2',
 'Untuk menyesali sesuatu di masa lalu yang tidak terjadi: If + had + verb-3, lalu would have + verb-3.',
 'If I knew, I would tell you.',
 'If I had known, I would have told you.'),

('clause-because-although',
 'Because / although',
 'Because dan although',
 'B1',
 'Jangan pakai dua penghubung untuk satu hubungan. "Although … but" mengulang makna yang sama.',
 'Although I was tired, but I finished it.',
 'Although I was tired, I finished it.'),

-- === PUNCTUATION & MECHANICS ==============================================
('punct-comma-splice',
 'Comma splice',
 'Dua kalimat disambung koma',
 'B1',
 'Dua kalimat utuh tidak bisa disambung hanya dengan koma. Pakai titik, atau tambahkan and/but/so.',
 'I tried it, it did not work.',
 'I tried it, but it did not work.'),

('punct-capital',
 'Capitalisation',
 'Huruf kapital',
 'A2',
 'Huruf kapital dipakai di awal kalimat, untuk nama diri, hari, bulan, dan nama bahasa.',
 'i study english every monday.',
 'I study English every Monday.'),

('punct-run-on',
 'Run-on sentence',
 'Kalimat beruntun',
 'B1',
 'Kalimat yang terlalu panjang tanpa tanda baca jadi sulit dibaca. Pecah jadi beberapa kalimat.',
 'I woke up late I missed the bus I arrived at nine.',
 'I woke up late. I missed the bus, so I arrived at nine.'),

-- === WORD CHOICE & STYLE ==================================================
('word-choice-false-friend',
 'False friends',
 'Kata yang mirip tapi beda arti',
 'B1',
 'Sebagian kata Inggris mirip kata Indonesia tapi artinya berbeda. "Actually" berarti sebenarnya, bukan "saat ini".',
 'Actually, I am working on my thesis right now.',
 'Currently, I am working on my thesis.'),

('word-choice-say-tell',
 'Say vs tell',
 'Say atau tell',
 'B1',
 '"Tell" selalu diikuti orang yang diberi tahu, "say" tidak.',
 'He said me that the deadline changed.',
 'He told me that the deadline changed.'),

('word-choice-make-do',
 'Make vs do',
 'Make atau do',
 'B1',
 '"Make" untuk menghasilkan sesuatu, "do" untuk melakukan aktivitas atau tugas.',
 'I need to make my homework tonight.',
 'I need to do my homework tonight.'),

('style-literal-translation',
 'Literal translation',
 'Terjemahan kata per kata',
 'B1',
 'Struktur bahasa Indonesia tidak selalu bisa diterjemahkan langsung. Ungkapan ini perlu bentuk yang berbeda dalam bahasa Inggris.',
 'How if we meet at three?',
 'How about we meet at three?'),

('style-redundancy',
 'Redundant words',
 'Kata yang berlebihan',
 'B2',
 'Hindari mengulang makna yang sama. "Repeat again" dan "return back" sudah mengandung arti pengulangan.',
 'Could you repeat again the last part?',
 'Could you repeat the last part?'),

('spelling-common',
 'Common spelling errors',
 'Kesalahan ejaan umum',
 'A2',
 'Beberapa kata sering salah tulis: receive, because, definitely, separate, necessary.',
 'I recieve your email yesterday.',
 'I received your email yesterday.')

on conflict (id) do update set
  title_en       = excluded.title_en,
  title_id       = excluded.title_id,
  cefr           = excluded.cefr,
  explanation_id = excluded.explanation_id,
  example_wrong  = excluded.example_wrong,
  example_right  = excluded.example_right;
