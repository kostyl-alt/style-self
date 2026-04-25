-- Sprint 21 Phase 4: inspirations テーブル作成

create table if not exists inspirations (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text not null,
  image_url     text,
  category      text not null check (category in ('designer', 'look', 'artwork', 'film', 'book')),
  tags          text[] not null default '{}',
  source_url    text,
  display_order integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table inspirations enable row level security;

create policy "inspirations_read_all" on inspirations
  for select using (true);

-- シードデータ（5件）
insert into inspirations (title, description, category, tags, display_order) values
  (
    'Rick Owens 2019SS',
    '構造そのものが美しさであることを証明したコレクション。余白と黒と重力——衣服は身体に対する建築的応答である。着ることは存在の重さを纏うことだと彼は言う。シルエットは常に重力に従い、素材は建材のように機能する。',
    'designer',
    ARRAY['構造美', '黒', '余白', '建築的', '重力'],
    1
  ),
  (
    'Yohji Yamamoto の哲学',
    '黒は色ではなく態度である。山本耀司は服を解体することで服の概念を問い直した。詩的な余白と非対称性——それは完成を拒否する姿勢そのもの。「美しさとは傷のようなもの」という言葉が示す通り、完璧さへの抵抗が彼のスタイルの核にある。',
    'designer',
    ARRAY['黒', '解体', '詩', '非対称', '余白'],
    2
  ),
  (
    'Martin Margiela 初期ルック',
    '匿名であることが最大の主張になる。ラベルを縫いつけないことで、誰もが服の語り手になれる。白いコート・解体されたスーツ——マルジェラは問いかける。「服とは何か？」。答えではなく問いを提示する稀有な才能。',
    'look',
    ARRAY['匿名性', '白', '解体', '概念'],
    3
  ),
  (
    'Wim Wenders の映画衣装',
    '都市を歩く孤独な人物——その衣服はいつも機能的で静かだ。ヴィム・ヴェンダースの映画において服は叫ばず、ただ存在する。それが最も雄弁なスタイル。パリ、テキサス——場所と服が一体となる瞬間の美学。',
    'film',
    ARRAY['都市', '静けさ', '機能', '孤独', 'ミニマル'],
    4
  ),
  (
    '川久保玲 インタビュー',
    '「美しくないものこそ美しい」——川久保玲の言葉は服の概念を根底から問い直す。反抗は構造に宿る。コムデギャルソンは服ではなく概念を作っている。ファッションとは問いであり、着ることは哲学的行為である。',
    'designer',
    ARRAY['反抗', '構造', '概念', '非美'],
    5
  );
