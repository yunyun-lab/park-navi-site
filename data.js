/* パークのデータ（事前に調べた情報）
   - 待ち時間 wait は「平日のふつうの日」の目安（推定）。当日はリアルタイムの値で上書き
   - height は身長制限（インチ）。0 = 制限なし
   - id は ThemeParks.wiki のID。リアルタイム情報と結びつけるのに使う
   - match はIDが季節で変わるもの（ホリデー版など）を名前で探すためのキーワード
   - グッズ・食べ歩き・レストランは guide.js（tools/build_guide.py で作成） */
window.PARK_DATA = {
  updated: "2026-10-09（休止情報を確認済み）",
  parks: {
    dl: {
      id: "7340550b-c14d-4def-80bb-acdb51d49a66",
      ja: "ディズニーランド", en: "Disneyland Park",
      hours: { open: "08:00", close: "23:00" },
      entrance: "main",
      lands: {
        main:  { ja: "メインストリートUSA", en: "Main Street, U.S.A.", x: 50, y: 92 },
        adv:   { ja: "アドベンチャーランド", en: "Adventureland", x: 30, y: 80 },
        nos:   { ja: "ニューオーリンズ", en: "New Orleans Square", x: 16, y: 60 },
        bayou: { ja: "バイユー・カントリー", en: "Bayou Country", x: 16, y: 34 },
        front: { ja: "フロンティアランド", en: "Frontierland", x: 40, y: 46 },
        gal:   { ja: "スター・ウォーズ", en: "Galaxy's Edge", x: 16, y: 10 },
        fant:  { ja: "ファンタジーランド", en: "Fantasyland", x: 64, y: 34 },
        toon:  { ja: "トゥーンタウン", en: "Mickey's Toontown", x: 62, y: 8 },
        tomo:  { ja: "トゥモローランド", en: "Tomorrowland", x: 84, y: 70 },
        hub:   { ja: "中央広場", en: "Central Plaza", x: 50, y: 68, hidden: true }
      },
    },
    dca: {
      id: "832fcd51-ea19-4e77-85c7-75d5843b127c",
      ja: "カリフォルニア・アドベンチャー", en: "Disney California Adventure",
      hours: { open: "08:00", close: "21:00" },
      entrance: "bvs",
      lands: {
        bvs:  { ja: "ブエナビスタ・ストリート", en: "Buena Vista Street", x: 50, y: 92 },
        hol:  { ja: "ハリウッドランド", en: "Hollywood Land", x: 78, y: 72 },
        avg:  { ja: "アベンジャーズ", en: "Avengers Campus", x: 84, y: 48 },
        cars: { ja: "カーズランド", en: "Cars Land", x: 72, y: 22 },
        sfs:  { ja: "サンフランソウキョウ", en: "San Fransokyo Square", x: 48, y: 40 },
        griz: { ja: "グリズリー・ピーク", en: "Grizzly Peak", x: 20, y: 60 },
        pgp:  { ja: "パラダイス・ガーデンズ", en: "Paradise Gardens Park", x: 16, y: 30 },
        pier: { ja: "ピクサー・ピア", en: "Pixar Pier", x: 40, y: 10 }
      },
    }
  },

  /* type: ride（乗り物）/ show（ショー・パレード）/ food（食事）/ shop（お土産） */
  items: [
    /* ---------- ディズニーランド：乗り物 ---------- */
    { id: "c23af6ba-8515-406a-8a48-d0818ba0bfc9", park: "dl", type: "ride", land: "fant", ja: "ピーター・パン空の旅", en: "Peter Pan's Flight", height: 0, wait: 45, dur: 3, tag: "人気" },
    { id: "cc980e8e-192f-48b6-848c-27784084e54b", park: "dl", type: "ride", land: "fant", ja: "ダンボ・ザ・フライングエレファント", en: "Dumbo the Flying Elephant", height: 0, wait: 25, dur: 2 },
    { id: "3638ac09-9fce-4a43-8c79-8ebbe17afce2", park: "dl", type: "ride", land: "fant", ja: "イッツ・ア・スモールワールド（ホリデー）", en: "\"it's a small world\" Holiday", height: 0, wait: 20, dur: 14, from: "2026-11-13", note: "10/30〜11/12はホリデー版への準備で休止。11/13から再開" },
    { id: "f7904912-3f08-4563-b99e-fd59f43cc9f2", park: "dl", type: "ride", land: "fant", ja: "キング・アーサー・カルーセル", en: "King Arthur Carrousel", height: 0, wait: 10, dur: 3 },
    { id: "e0cfed11-96d7-40f3-907f-5cfed172592a", park: "dl", type: "ride", land: "fant", ja: "マッドティーパーティー", en: "Mad Tea Party", height: 0, wait: 15, dur: 2, closed: "9/14から休止中。公式は再開日未発表（10月中旬に再開との情報もあるので出発前に確認）" },
    { id: "a07f3110-013e-43bb-a182-e66bb8b5e28d", park: "dl", type: "ride", land: "fant", ja: "ふしぎの国のアリス", en: "Alice in Wonderland", height: 0, wait: 30, dur: 4 },
    { id: "cb929138-d77a-4dd2-983c-f651bbd1bd92", park: "dl", type: "ride", land: "fant", ja: "ストーリーブック・ランド・カナルボート", en: "Storybook Land Canal Boats", height: 0, wait: 25, dur: 8 },
    { id: "8e686e4c-f3db-4d9c-a185-2d54b1fa8899", park: "dl", type: "ride", land: "fant", ja: "ケイシー・ジュニア・サーカストレイン", en: "Casey Jr. Circus Train", height: 0, wait: 15, dur: 4 },
    { id: "90ee50d4-7cc9-4824-b29d-2aac801acc29", park: "dl", type: "ride", land: "fant", ja: "ピノキオの冒険旅行", en: "Pinocchio's Daring Journey", height: 0, wait: 15, dur: 3 },
    { id: "9d401ad3-49b2-469f-ac73-93eb429428fb", park: "dl", type: "ride", land: "fant", ja: "トード氏のワイルドライド", en: "Mr. Toad's Wild Ride", height: 0, wait: 20, dur: 2 },
    { id: "4f0053e7-b8db-4833-b02f-35e1c91b4523", park: "dl", type: "ride", land: "fant", ja: "白雪姫：魔法の願い", en: "Snow White's Enchanted Wish", height: 0, wait: 15, dur: 2 },
    { id: "faaa8be9-cc1e-4535-ac20-04a535654bd0", park: "dl", type: "ride", land: "fant", ja: "マッターホーン・ボブスレー", en: "Matterhorn Bobsleds", height: 42, wait: 40, dur: 4, tag: "人気" },
    { id: "cd670bff-81d1-4f34-8676-7bafdf49220a", park: "dl", type: "ride", land: "toon", ja: "ミッキー＆ミニーのランナウェイ・レイルウェイ", en: "Mickey & Minnie's Runaway Railway", height: 0, wait: 35, dur: 6, tag: "人気" },
    { id: "59647168-d239-4161-8b24-92eb128e96fb", park: "dl", type: "ride", land: "toon", ja: "チップとデールのガジェットコースター", en: "Chip 'n' Dale's GADGETcoaster", height: 35, wait: 25, dur: 1, note: "子ども向けコースター。89cmあれば乗れる" },
    { id: "6ce9cdd1-0a43-459e-83cd-f4cace9cfa7b", park: "dl", type: "ride", land: "toon", ja: "ロジャーラビットのカートゥーンスピン", en: "Roger Rabbit's Car Toon Spin", height: 0, wait: 25, dur: 4 },
    { id: "c02fb82d-0860-4e95-8c61-899fa594d20e", park: "dl", type: "ride", land: "toon", ja: "ミニーの家", en: "Minnie's House", height: 0, wait: 10, dur: 10 },
    { id: "b0eca3d3-a519-47f9-a5a7-9911126da2df", park: "dl", type: "ride", land: "toon", ja: "グーフィーの遊び場", en: "Goofy's How-to-Play Yard", height: 0, wait: 0, dur: 20, note: "小さい子が走り回れる遊び場" },
    { id: "9167db1d-e5e7-46da-a07f-ae30a87bc4c4", park: "dl", type: "ride", land: "tomo", ja: "スペース・マウンテン", en: "Space Mountain", height: 40, wait: 45, dur: 3, tag: "人気" },
    { id: "88197808-3c56-4198-a5a4-6066541251cf", park: "dl", type: "ride", land: "tomo", ja: "バズ・ライトイヤー・アストロブラスター", en: "Buzz Lightyear Astro Blasters", height: 0, wait: 25, dur: 5 },
    { id: "6c225598-91c9-44a3-95e2-7c423475db61", park: "dl", type: "ride", land: "tomo", ja: "アストロ・オービター", en: "Astro Orbitor", height: 0, wait: 20, dur: 2 },
    { id: "1da85181-bf0f-4ccc-b98e-243142f7347b", park: "dl", type: "ride", land: "tomo", ja: "オートピア", en: "Autopia", height: 32, wait: 25, dur: 5, note: "81cm以上・大人と同乗。1人運転は137cm以上" },
    { id: "64d44aaa-6857-4693-b24b-bcff6c6dcfa1", park: "dl", type: "ride", land: "tomo", ja: "ファインディング・ニモ・サブマリン", en: "Finding Nemo Submarine Voyage", height: 0, wait: 30, dur: 13 },
    { id: "cc718d11-fa15-44ee-87d0-ded989ad61bc", park: "dl", type: "ride", land: "tomo", ja: "スター・ツアーズ", en: "Star Tours", height: 40, wait: 20, dur: 5 },
    { id: "56d0bd6d-5106-4420-8f60-0005475c04c3", park: "dl", type: "ride", land: "tomo", ja: "ディズニーランド・モノレール", en: "Disneyland Monorail", height: 0, wait: 10, dur: 12,
      move: { stops: [{ ja: "トゥモローランド駅", en: "Tomorrowland Station", land: "tomo" }, { ja: "ダウンタウン・ディズニー駅（パークの外）", en: "Downtown Disney Station (outside the park)", out: true }],
        how: "2つの駅を行き来する（1往復 約13分）。ダウンタウン・ディズニーで降りるとパークの外に出る", howEn: "Shuttles between 2 stations (about 13 min round trip). Getting off at Downtown Disney takes you out of the park",
        tip: "ダウンタウン・ディズニーから乗るにはディズニーランドのチケットが必要。ベビーカーはたたむ（レンタルは不可）" } },
    { id: "34b1d70f-11c4-42df-935e-d5582c9f1a8e", park: "dl", type: "ride", land: "gal", ja: "ライズ・オブ・ザ・レジスタンス", en: "Star Wars: Rise of the Resistance", height: 40, wait: 60, dur: 18, tag: "人気" },
    { id: "b2c2549c-e9da-4fdd-98ea-1dcff596fed7", park: "dl", type: "ride", land: "gal", ja: "ミレニアム・ファルコン：スマグラーズ・ラン", en: "Millennium Falcon: Smugglers Run", height: 38, wait: 40, dur: 5 },
    { id: "0de1413a-73ee-46cf-af2e-c491cc7c7d3b", park: "dl", type: "ride", land: "front", ja: "ビッグサンダー・マウンテン", en: "Big Thunder Mountain Railroad", height: 40, wait: 35, dur: 4, tag: "人気" },
    { id: "6c30d5b0-8c0a-406f-9258-0b6c55d4a5e4", park: "dl", type: "ride", land: "front", ja: "マークトウェイン号", en: "Mark Twain Riverboat", height: 0, wait: 10, dur: 14 , move: { loop: true } },
    { id: "c9e39189-7e99-4e0a-97e0-4a0d5654d257", park: "dl", type: "ride", land: "front", ja: "帆船コロンビア号", en: "Sailing Ship Columbia", height: 0, wait: 10, dur: 14 , move: { loop: true } },
    { id: "07952343-3498-404b-8337-734de9a185c1", park: "dl", type: "ride", land: "front", ja: "トムソーヤ島（海賊の隠れ家）", en: "Pirate's Lair on Tom Sawyer Island", height: 0, wait: 5, dur: 30 },
    { id: "a9076acd-7630-4bad-a8da-e6bd689ddcac", park: "dl", type: "ride", land: "bayou", ja: "ティアナのバイユー・アドベンチャー", en: "Tiana's Bayou Adventure", height: 40, wait: 40, dur: 10, tag: "人気", note: "濡れることあり" },
    { id: "52a8ef64-d54c-4974-883f-027c3026e3f1", park: "dl", type: "ride", land: "bayou", ja: "プーさんの冒険", en: "The Many Adventures of Winnie the Pooh", height: 0, wait: 20, dur: 4 },
    { id: "5bd95ae8-181d-449c-8f04-a621e2448961", park: "dl", type: "ride", land: "bayou", ja: "デイビー・クロケットのカヌー探険", en: "Davy Crockett's Explorer Canoes", height: 0, wait: 15, dur: 12 , move: { loop: true } },
    { id: "82aeb29b-504a-416f-b13f-f41fa5b766aa", park: "dl", type: "ride", land: "nos", ja: "カリブの海賊", en: "Pirates of the Caribbean", height: 0, wait: 20, dur: 15, tag: "人気", note: "暗くて落ちる場面あり。怖がる子もいる" },
    { id: "ff52cb64-c1d5-4feb-9d43-5dbd429bac81", park: "dl", type: "ride", land: "nos", ja: "ホーンテッドマンション・ホリデー", en: "Haunted Mansion Holiday", height: 0, wait: 35, dur: 9, tag: "人気", note: "暗くて怖がる子もいる" },
    { id: "2aedc657-1ee2-4545-a1ce-14753f28cc66", park: "dl", type: "ride", land: "adv", ja: "インディ・ジョーンズ・アドベンチャー", en: "Indiana Jones Adventure", height: 46, wait: 45, dur: 4, tag: "人気", closed: "9/8から休止中・再開日は未発表。11/20まで運営時間の掲載がなく、旅行中も休止の見込み" },
    { id: "1b83fda8-d60e-48e4-9a3d-90ddcbcd1001", park: "dl", type: "ride", land: "adv", ja: "ジャングルクルーズ", en: "Jungle Cruise", height: 0, wait: 30, dur: 8 },
    { id: "106c1e5a-a5e7-42d7-96ab-bc100d8faf71", park: "dl", type: "ride", land: "adv", ja: "魅惑のチキルーム", en: "Walt Disney's Enchanted Tiki Room", height: 0, wait: 10, dur: 16 },
    { id: "e27b1db8-9ec9-4f8b-9ca6-fd6377de66ee", park: "dl", type: "ride", land: "adv", ja: "アドベンチャーランド・ツリーハウス", en: "Adventureland Treehouse", height: 0, wait: 5, dur: 15 },
    { id: "e2d460e9-2bef-4613-b126-092ab7cb37e5", park: "dl", type: "ride", land: "main", ja: "ディズニーランド鉄道", en: "Disneyland Railroad", height: 0, wait: 10, dur: 20,
      move: { ring: true, stops: [{ ja: "メインストリート駅", en: "Main Street, U.S.A.", land: "main" }, { ja: "ニューオーリンズ・スクエア駅", en: "New Orleans Square", land: "nos" }, { ja: "トゥーンタウン駅", en: "Mickey's Toontown", land: "toon" }, { ja: "トゥモローランド駅", en: "Tomorrowland", land: "tomo" }],
        how: "時計回りの一方通行で1周 約18〜20分。どの駅でも乗り降りできる", howEn: "One-way clockwise loop, about 18–20 min. Hop on and off at any station",
        tip: "ベビーカーはたためば乗せられるという情報あり（レンタルは不可）。駅のキャストに確認を。風の強い花火の日は止まることがある" } },
    { match: "Main Street Vehicles", park: "dl", type: "ride", land: "main", ja: "メインストリート・ビークル", en: "Main Street Vehicles", height: 0, wait: 5, dur: 5,
      note: "馬車鉄道・消防車・オムニバスなどの昔の乗り物",
      move: { stops: [{ ja: "タウンスクエア（入口側）", en: "Town Square", land: "main" }, { ja: "お城前の中央広場", en: "Central Plaza", land: "main" }],
        how: "入口側とお城前のあいだを片道だけ走る。運行は朝8時〜15時ごろ", howEn: "One way between Town Square and Central Plaza. Usually 8 AM–3 PM",
        tip: "パレードやショーの前後は止まる。11/13からはパレードがあるので止まる時間が増える" } },

    /* ---------- ディズニーランド：ショー・パレード ---------- */
    { id: null, match: "Christmas Fantasy", park: "dl", type: "show", sub: "parade", land: "main", ja: "クリスマス・ファンタジー・パレード", en: "A Christmas Fantasy Parade", from: "2026-11-13", dur: 40, hold: 30, tag: "ホリデー", note: "場所取りは30分前〜が目安" },
    { id: null, match: "Believe", park: "dl", type: "show", sub: "night", land: "main", ja: "花火「ビリーブ…イン・ホリデー・マジック」", en: "Believe… in Holiday Magic", from: "2026-11-13", dur: 15, hold: 45, tag: "ホリデー", note: "お城の正面〜メインストリートで見る。雪が降る演出あり" },
    { id: null, match: "Wintertime", park: "dl", type: "show", sub: "night", land: "hub", ja: "お城のライティング", en: "Wintertime Enchantment", from: "2026-11-13", dur: 5, hold: 10, tag: "ホリデー" },
    { id: "8c36ff0b-3a32-4d7b-9388-0516c19277db", park: "dl", type: "show", sub: "night", land: "front", ja: "ファンタズミック！", en: "Fantasmic!", dur: 22, hold: 45, note: "公式の11月の日程は未発表。TouringPlansの予定では11/13〜15の夜（21:00・22:30）。11/11・12・16はなしの見込み" },
    { id: "95a9cde3-ff1f-40a3-8276-2477ded688f8", park: "dl", type: "show", sub: "stage", land: "fant", ja: "ブルーイのショー", en: "Bluey's Best Day Ever!", dur: 20, hold: 15, tag: "子ども向け", dow: [4, 5, 6, 0, 1], note: "10月から木〜月曜のみ（火・水はなし）。11/11（水）はお休み" },
    { id: "5a107a57-9174-4f3f-9be7-625a5d5bb899", park: "dl", type: "show", sub: "greet", land: "toon", ja: "ミッキーの家とミート・ミッキー", en: "Mickey's House and Meet Mickey", dur: 15, hold: 0, tag: "子ども向け" },



    /* ---------- カリフォルニア・アドベンチャー：乗り物 ---------- */
    { id: "c60c768b-3461-465c-8f4f-b44b087506fc", park: "dca", type: "ride", land: "cars", ja: "ラジエーター・スプリングス・レーサーズ", en: "Radiator Springs Racers", height: 40, wait: 60, dur: 6, tag: "人気" },
    { id: null, match: "Mater", park: "dca", type: "ride", land: "cars", ja: "メーターのジングル・ジャンボリー", en: "Mater's Jingle Jamboree", height: 32, wait: 20, dur: 2, note: "ホリデー版は11/13〜（それまでは通常版）" },
    { id: null, match: "Luigi", park: "dca", type: "ride", land: "cars", ja: "ルイジのジョイ・トゥ・ザ・ワール", en: "Luigi's Joy to the Whirl", height: 32, wait: 20, dur: 2, note: "ホリデー版は11/13〜（それまでは通常版）" },
    { id: "5d07a2b1-49ca-4de7-9d32-6d08edf69b08", park: "dca", type: "ride", land: "pier", ja: "インクレディコースター", en: "Incredicoaster", height: 48, wait: 35, dur: 3, tag: "人気" },
    { id: "86ab3069-110d-49c5-a7e7-29ddf28695a6", park: "dca", type: "ride", land: "pier", ja: "トイ・ストーリー・マニア！", en: "Toy Story Midway Mania!", height: 0, wait: 35, dur: 7, tag: "人気" },
    { id: "388ad3f1-5cf5-4a9d-8d0e-6dfb817d7822", park: "dca", type: "ride", land: "pier", ja: "ジェシーのクリッター・カルーセル", en: "Jessie's Critter Carousel", height: 0, wait: 10, dur: 3 },
    { id: "6d876f4c-c3ff-4ae3-a2d8-d4b831e1039b", park: "dca", type: "ride", land: "pier", ja: "インサイド・ヘッド", en: "Inside Out Emotional Whirlwind", height: 0, wait: 30, dur: 2 },
    { id: "528016ef-db24-47fa-a0f2-b6d26d61e29f", park: "dca", type: "ride", land: "pier", ja: "ピクサー・パル・ア・ラウンド（観覧車）", en: "Pixar Pal-A-Round", height: 0, wait: 15, dur: 10 },
    { id: "2295351d-ce6b-4c04-92d5-5b416372c5b5", park: "dca", type: "ride", land: "avg", ja: "ウェブ・スリンガーズ", en: "WEB SLINGERS: A Spider-Man Adventure", height: 0, wait: 35, dur: 5 },
    { id: "b7678dab-5544-48d5-8fdc-c1a0127cfbcd", park: "dca", type: "ride", land: "avg", ja: "ガーディアンズ・オブ・ギャラクシー：ミッション・ブレイクアウト！", en: "Guardians of the Galaxy – Mission: BREAKOUT!", height: 40, wait: 45, dur: 3, tag: "人気" },
    { id: "40524fba-5d84-49e7-9204-f493dbe2d5a4", park: "dca", type: "ride", land: "hol", ja: "モンスターズ・インク", en: "Monsters, Inc. Mike & Sulley to the Rescue!", height: 0, wait: 20, dur: 4, note: "2027年に営業終了予定。11月は営業" },
    { id: "7561bcd8-18ea-4e3f-89d5-c905b7ba3d42", park: "dca", type: "ride", land: "hol", ja: "タートル・トーク", en: "Turtle Talk with Crush", height: 0, wait: 15, dur: 15 },
    { id: "8f586a2f-cef5-46d3-b822-fd622c4e9e33", park: "dca", type: "ride", land: "hol", ja: "ミッキーのフィルハーマジック", en: "Mickey's PhilharMagic", height: 0, wait: 10, dur: 12 },
    { id: "77f205a4-d482-4d91-a5ff-71e54a086ad2", park: "dca", type: "ride", land: "griz", ja: "ソアリン・アクロス・アメリカ", en: "Soarin' Across America", height: 40, wait: 30, dur: 6 },
    { id: "b1d285a7-2444-4a7c-b7bb-d2d4d6428a85", park: "dca", type: "ride", land: "griz", ja: "グリズリー・リバー・ラン", en: "Grizzly River Run", height: 42, wait: 25, dur: 5, note: "かなり濡れる" },
    { id: "c9803366-6f37-4406-82af-7692357e3ca9", park: "dca", type: "ride", land: "griz", ja: "レッドウッド・クリーク・チャレンジトレイル", en: "Redwood Creek Challenge Trail", height: 0, wait: 0, dur: 25, note: "遊び場。丸太のすべり台は81cm（32in）以上、ロッククライミングは107cm（42in）以上。11/13からはサンタに会える場所に", off: ["2026-11-01", "2026-11-12"] },
    { id: "e1fbc7a1-2cd1-4282-b373-ac11d9d9d38a", park: "dca", type: "ride", land: "pgp", ja: "リトル・マーメイド：アリエルのアンダーシー・アドベンチャー", en: "The Little Mermaid – Ariel's Undersea Adventure", height: 0, wait: 15, dur: 7 },
    { id: "f44a5072-3cda-4c7c-8574-33ad09d16cca", park: "dca", type: "ride", land: "pgp", ja: "グーフィーのスカイスクール", en: "Goofy's Sky School", height: 42, wait: 30, dur: 2 },
    { id: "4f5b28d0-b78e-482b-8e2e-1f90756d6220", park: "dca", type: "ride", land: "pgp", ja: "シリー・シンフォニー・スウィング", en: "Silly Symphony Swings", height: 40, wait: 20, dur: 2, note: "2人乗りは102cm以上、1人乗りは122cm以上" },
    { id: "c8a4b7b1-c1b2-4dfe-b73c-4e834b4a73db", park: "dca", type: "ride", land: "pgp", ja: "ジャンピン・ジェリーフィッシュ", en: "Jumpin' Jellyfish", height: 40, wait: 15, dur: 2 },
    { id: "10a5fc6f-5ad3-414b-9bdd-e6bae097b6ad", park: "dca", type: "ride", land: "pgp", ja: "ゴールデン・ゼファー", en: "Golden Zephyr", height: 0, wait: 15, dur: 3 },

    /* ---------- カリフォルニア・アドベンチャー：ショー ---------- */
    { id: null, match: "Happy Holidays", park: "dca", type: "show", sub: "parade", land: "hol", ja: "ミッキーのハッピー・ホリデー", en: "Mickey's Happy Holidays", from: "2026-11-13", dur: 20, hold: 20, tag: "ホリデー", note: "キャラクターの行列（カヴァルケード）。パラダイス・ガーデンズ・パークからハリウッドランドへ進む" },
    { id: null, match: "Navidad", park: "dca", type: "show", sub: "parade", land: "pgp", ja: "ビバ・ナビダ！", en: "Disney ¡Viva Navidad!", from: "2026-11-13", dur: 25, hold: 15, tag: "ホリデー", note: "開催は一部の日だけ（昨年は土日）。2026年の曜日は未発表" },
    { id: "e46d8982-4991-4b9e-8e4a-b519d3ca6060", match: "World of Color", park: "dca", type: "show", sub: "night", land: "pgp", ja: "ワールド・オブ・カラー", en: "World of Color", dur: 25, hold: 45, note: "11/13〜はホリデー版「シーズン・オブ・ライト」。11/11・12は通常版「ワールド・オブ・カラー・ワン」" },
    { id: null, match: "Clubhouse", park: "dca", type: "show", sub: "stage", land: "hol", ja: "ミッキーマウス・クラブハウス・ライブ！", en: "Disney Jr. Mickey Mouse Clubhouse Live!", from: "2026-11-01", dur: 25, hold: 15, tag: "子ども向け" },
    { id: "bdb0a3ec-eb7a-41c9-918f-ccee7194743e", park: "dca", type: "show", sub: "stage", land: "avg", ja: "スパイダーマンのスタント", en: "The Amazing Spider-Man!", dur: 5, hold: 10 },
    { id: "449e351b-a05a-4a52-8893-0ed5c1f6fc48", park: "dca", type: "show", sub: "stage", land: "bvs", ja: "ファイブ・アンド・ダイム（バンド）", en: "Five & Dime", dur: 20, hold: 5 },


  ],

  /* 混雑の目安（統計・予想ベース。数字ではなく傾向） */
  crowd: [
    { date: "2026-11-11", level: 3, ja: "退役軍人の日（祝日）。水曜なので、ふだんの祝日ほどは混まない予想" },
    { date: "2026-11-12", level: 4, ja: "ホリデー開始の前日。混みやすい予想" },
    { date: "2026-11-13", level: 4, ja: "ホリデーシーズン初日。夜のショーが始まり、金曜の夜は特に混む" },
    { date: "2026-11-14", level: 4, ja: "ホリデー最初の週末。混む予想" },
    { date: "2026-11-15", level: 3, ja: "日曜。日中は混むが、夜は比較的落ち着く傾向" },
    { date: "2026-11-16", level: 4, ja: "月曜。最近いちばん混みやすい曜日" }
  ],
  crowdSource: "TouringPlans の混雑予想（2026年10月時点）と Disney Tourist Blog の曜日の傾向、ホリデー開始日（11/13）の発表をもとにした目安"
};
