graph TD
A[调用 getStudyCards(user_id, limit)] --> B{调用 WordflowService.generateStudyCards(user_id, limit)};

    %% WordflowService.generateStudyCards 内部逻辑
    B --> C{获取用户WFDB实例 getUserWFDB(user_id)};
    C --> D{从用户WFDB获取 keys.user_study_cards 数组 getAllArray()};
    D --> E{判断 user_study_cards.length > limit?};
    E -- 是 --> F[直接返回 user_study_cards 数组];
    E -- 否 --> G{调用 getUserUnknowns(user_id) 获取生词列表};
    G --> H{使用 lodash shuffle() 打乱生词列表得到 shuffledWords};
    H --> I[异步调用 AiService.generateStudyCards(shuffledWords, user_id) 但不等待];
    I --> J[立即返回空数组 []];

    %% 回到 getStudyCards 主流程
    F --> K{getStudyCards 接收到 study_cards};
    J --> K;
    K --> L{判断 study_cards.length === 0?};

    %% 如果是空数组的分支
    L -- 是 --> M[从 cards_db 随机获取 limit 个卡片];
    M --> N[提取随机卡片的 key 列表];
    N --> O[将随机卡片keys保存到 user_study_cards_history];
    O --> P{返回随机卡片完整数据};

    %% 如果有卡片的分支
    L -- 否 --> Q{判断 study_cards.length > limit?};
    Q -- 是 --> R[取前limit个作为cardsToReturn，剩余作为remainingCards];
    R --> S[用remainingCards覆盖更新user_study_cards];
    S --> T[将cardsToReturn保存到user_study_cards_history];
    T --> U{从cards_db批量获取cardsToReturn完整数据};
    U --> P;

    Q -- 否 --> V[将study_cards全部作为cardsToReturn];
    V --> W[清空user_study_cards];
    W --> X[将cardsToReturn保存到user_study_cards_history];
    X --> Y{从cards_db批量获取cardsToReturn完整数据};
    Y --> P;

    %% AiService.generateStudyCards 异步执行的逻辑 (并行执行)
    I --> AA[AiService.generateStudyCards 开始异步执行];
    AA --> BB{获取用户元数据 getUserMeta(user_id)};
    BB --> CC{获取用户WFDB实例};
    CC --> DD{获取用户当前待学习卡片};
    DD --> EE{解构用户元数据获取 current_vocabulary 和 interest_tag};
    EE --> FF{构建包含用户兴趣的 AI Prompt};
    FF --> GG[将主任务加入处理队列 addToQueue()];

    %% addToQueue 内部的队列任务执行逻辑
    GG --> HH[队列任务开始执行];
    HH --> II{配置 Gemini API (systemInstruction, proxyUrl)};
    II --> JJ{获取随机 Gemini API Key};
    JJ --> KK{初始化 GeminiHelper 实例};
    KK --> LL[调用 filterWords(words, user_meta, LIMIT_BATCH_WORDS, user_wfdb)];

    %% filterWords 函数内部逻辑
    LL --> MM{filterWords开始执行};
    MM --> NN{初始化变量: filtered_words=[], exists_hashs=[], chunkSize=5};
    NN --> OO{循环遍历words，每次处理chunkSize=5个单词};
    OO --> PP{检查filtered_words.length >= limit?};
    PP -- 是 --> QQ[跳出循环];
    PP -- 否 --> RR{切片获取当前chunk单词块};
    RR --> SS{为chunk生成Hash: generateCardsHash(chunk, user_interests)};
    SS --> TT{检查Hash是否存在于cards_db中};
    TT -- 存在 --> UU[将Hash添加到exists_hashs列表];
    TT -- 不存在 --> VV[将chunk中的单词添加到filtered_words列表];
    UU --> WW{检查是否还有更多单词块需要处理};
    VV --> WW;
    WW -- 是 --> OO;
    WW -- 否 --> QQ;
    QQ --> XX[将exists_hashs保存到user_study_cards];
    XX --> YY{返回filtered_words列表 (限制在limit以内)};

    %% 回到队列任务执行
    YY --> ZZ{将filtered_words用逗号连接发送给Gemini AI};
    ZZ --> AAA{接收AI响应};
    AAA --> BBB{提取JSON部分 (处理markdown代码块)};
    BBB --> CCC{解析JSON为generated_sentences数组};
    CCC --> DDD{验证数组结构有效性};
    DDD -- 验证失败 --> EEE[记录错误并抛出异常];
    DDD -- 验证成功 --> FFF{过滤出结构有效的卡片对象};
    FFF --> GGG{循环处理每个有效的generated_sentence};
    GGG --> HHH{为当前sentence的used_words生成Hash};
    HHH --> III{构建完整的卡片对象CardsType};
    III --> JJJ{将卡片存储到cards_db中 put(hash, card)};
    JJJ --> KKK[将hash添加到hashs列表];
    KKK --> LLL{检查是否还有更多sentence需要处理};
    LLL -- 是 --> GGG;
    LLL -- 否 --> MMM[将hashs列表保存到user_study_cards];
    MMM --> NNN[添加1秒延迟];
    NNN --> OOO{返回验证后的generated_sentences};
    OOO --> PPP[队列任务执行完毕];

    P --> QQQ[getStudyCards函数执行完毕];
    PPP --> RRR[AiService.generateStudyCards异步任务完成];
