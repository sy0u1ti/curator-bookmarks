import {
  normalizeSearchTextCompact,
  normalizeText
} from '../text.js'

export interface PinyinTokens {
  full: string[]
  initials: string[]
}

export interface PinyinEnrichTarget {
  tagPinyinFull: string[]
  tagPinyinInitials: string[]
  searchText: string
  searchTextCompact?: string
  title: string
  path?: string
  tagTopics?: string[]
  tagTags?: string[]
  tagAliases?: string[]
  pinyinEnriched?: boolean
  pinyinBaseSearchText?: string
}

export interface CooperativeEnrichOptions {
  isActive?: () => boolean
  yieldWork?: () => Promise<unknown>
  batchSize?: number
  onProgress?: (processed: number, total: number) => void
}

const COMPACT_PINYIN_GROUPS: Array<[string, string]> = [
  ['a', '阿啊呵吖嗄腌锕'],
  ['ai', '爱埃艾碍哀挨矮唉癌隘蔼皑嗳暧捱瑷霭'],
  ['an', '安案按岸暗俺鞍氨胺庵黯谙铵桉'],
  ['ang', '昂肮盎'],
  ['ao', '奥澳傲熬凹敖袄懊翱鳌拗'],
  ['ba', '把吧八爸巴拔罢霸坝芭疤扒跋靶耙叭笆粑岜灞'],
  ['bai', '百白败摆柏拜佰稗捭'],
  ['ban', '办版半班般板伴搬斑扮拌瓣颁坂绊扳'],
  ['bang', '帮榜邦棒傍膀绑磅蚌镑谤梆'],
  ['bao', '保报包宝抱暴爆薄胞饱堡褒豹刨苞鲍瀑鸨'],
  ['bei', '被北备背倍杯贝悲辈卑碑蓓惫焙钡狈'],
  ['ben', '本奔笨苯贲锛'],
  ['beng', '崩泵蹦绷甭迸蚌嘣'],
  ['bi', '比必笔毕币避闭壁逼鼻彼碧臂蔽弊辟璧毙鄙庇痹匕敝婢'],
  ['bian', '变边便编遍辨辩扁贬鞭卞辫匾汴砭'],
  ['biao', '表标彪膘镖飙婊裱'],
  ['bie', '别憋瘪蹩鳖'],
  ['bin', '宾滨彬斌濒缤殡鬓'],
  ['bing', '并病兵冰柄饼秉丙禀炳摒'],
  ['bo', '博波播拨伯玻泊薄柏勃驳卜脖搏剥菠舶渤帛簸钵铂'],
  ['bu', '不部步布补捕卜堡哺怖簿埔埠钚'],
  ['ca', '擦嚓礤'],
  ['cai', '才菜财材采彩裁猜蔡踩睬'],
  ['can', '参残餐灿惭惨蚕璨粲'],
  ['cang', '藏仓苍舱沧伧'],
  ['cao', '草操曹槽糙嘈漕'],
  ['ce', '策测侧册厕恻'],
  ['ceng', '层曾蹭噌'],
  ['cha', '查差茶插察叉茬岔刹诧碴搽杈'],
  ['chai', '柴拆差豺钗'],
  ['chan', '产单禅缠蝉掺搀颤馋铲阐忏潺蟾'],
  ['chang', '长常场厂唱尝昌偿畅倡肠敞猖娼淌'],
  ['chao', '超朝潮炒吵抄巢嘲钞绰剿'],
  ['che', '车彻撤扯澈掣'],
  ['chen', '陈沉晨臣尘辰趁衬称琛嗔忱郴'],
  ['cheng', '成程城称承呈乘诚盛撑惩澄橙秤逞骋铛'],
  ['chi', '吃持迟赤尺池齿翅斥驰耻痴匙弛炽侈嗤叱'],
  ['chong', '重充冲虫崇宠涌憧忡'],
  ['chou', '抽愁臭丑酬仇筹绸瞅稠踌畴'],
  ['chu', '出处初楚除触储厨础畜躇橱雏矗搐锄杵'],
  ['chuai', '揣踹啜'],
  ['chuan', '传船穿川串喘椽舛'],
  ['chuang', '创窗床闯疮幢'],
  ['chui', '吹垂锤捶炊椎槌'],
  ['chun', '春纯唇醇蠢淳椿'],
  ['chuo', '戳绰啜辍龊'],
  ['ci', '此次词刺辞慈磁瓷赐茨祠雌疵'],
  ['cong', '从丛聪匆葱囱琮'],
  ['cou', '凑楱'],
  ['cu', '促粗簇醋卒猝蹙'],
  ['cuan', '窜攒篡蹿'],
  ['cui', '催脆翠崔摧粹萃淬悴'],
  ['cun', '存村寸忖'],
  ['cuo', '错措搓挫撮磋蹉'],
  ['da', '大打达答搭瘩塔嗒耷'],
  ['dai', '代带待呆戴袋贷逮歹傣怠殆'],
  ['dan', '但单担弹淡蛋丹胆旦氮诞耽掸惮澹'],
  ['dang', '当党档荡挡铛裆宕'],
  ['dao', '到道导倒岛刀盗蹈悼稻捣祷叨'],
  ['de', '的地得德底锝'],
  ['dei', '得'],
  ['deng', '等登灯邓凳瞪蹬澄噔'],
  ['di', '地第低底敌抵递帝弟滴迪蒂缔堤笛涤嘀狄邸'],
  ['dian', '点电店典颠垫殿淀惦掂滇碘踮'],
  ['diao', '调掉雕吊钓刁叼碉凋'],
  ['die', '跌叠蝶爹碟迭谍牒'],
  ['ding', '定顶丁订盯鼎钉叮锭町'],
  ['diu', '丢铥'],
  ['dong', '动东懂洞冬董冻栋侗恫胴'],
  ['dou', '都斗豆逗抖陡兜蚪窦'],
  ['du', '度都读独毒堵赌杜渡督肚镀妒睹嘟犊'],
  ['duan', '短段断端锻缎椴'],
  ['dui', '对队堆兑怼碓'],
  ['dun', '顿盾吨敦蹲钝墩囤遁'],
  ['duo', '多夺朵躲舵堕跺剁咄惰哆'],
  ['e', '额俄恶饿呃鹅峨娥扼厄遏鄂噩鳄'],
  ['en', '恩嗯摁'],
  ['er', '而二尔儿耳饵洱贰'],
  ['fa', '发法罚乏阀伐筏珐'],
  ['fan', '反范饭犯凡翻繁返番烦贩帆泛藩樊梵'],
  ['fang', '方放房防访仿芳坊妨纺肪'],
  ['fei', '非飞费肥废肺菲匪啡沸翡斐吠'],
  ['fen', '分份粉奋芬愤纷坟粪焚氛汾忿'],
  ['feng', '风封丰峰锋凤奉疯逢冯缝蜂枫讽烽'],
  ['fo', '佛'],
  ['fou', '否缶'],
  ['fu', '服复副府夫负富父付福附扶符赴妇伏浮腹幅覆赋傅腐肤辅抚咐俯斧缚甫'],
  ['ga', '噶嘎尬尕'],
  ['gai', '该改概盖钙溉丐赅'],
  ['gan', '感干敢赶甘肝杆赣尴竿柑秆擀'],
  ['gang', '港刚钢岗纲缸杠冈肛'],
  ['gao', '高告搞稿膏糕皋镐羔'],
  ['ge', '个各格歌哥革隔割阁戈搁胳鸽葛咯疙'],
  ['gei', '给'],
  ['gen', '根跟亘艮'],
  ['geng', '更耕庚梗耿羹埂'],
  ['gong', '公共工功供攻宫恭巩贡躬拱龚弓'],
  ['gou', '够构购狗沟勾钩苟垢篝'],
  ['gu', '古股故顾固骨谷鼓估孤姑雇辜咕菇沽蛊箍'],
  ['gua', '挂刮瓜寡卦褂呱'],
  ['guai', '怪乖拐'],
  ['guan', '关管官观馆惯冠贯罐棺莞灌'],
  ['guang', '光广逛咣犷'],
  ['gui', '规贵归轨鬼桂柜硅跪龟闺瑰诡'],
  ['gun', '滚棍辊衮'],
  ['guo', '国过果锅郭裹帼蝈'],
  ['ha', '哈蛤'],
  ['hai', '还海害孩亥骇嗨'],
  ['han', '汉含寒喊韩汗涵函翰旱罕憾捍焊撼瀚'],
  ['hang', '行航杭巷夯吭'],
  ['hao', '好号浩毫豪耗郝皓昊壕嚎'],
  ['he', '和合何河核喝赫荷盒贺呵鹤禾褐壑'],
  ['hei', '黑嘿'],
  ['hen', '很恨狠痕'],
  ['heng', '衡横恒哼亨蘅'],
  ['hong', '红宏洪轰虹鸿哄弘烘泓'],
  ['hou', '后候厚侯猴喉吼逅'],
  ['hu', '湖户护互呼胡忽虎狐糊壶沪弧蝴葫唬惚'],
  ['hua', '化华话花画滑划哗桦猾'],
  ['huai', '坏怀淮槐徊'],
  ['huan', '换还环欢缓幻患唤焕桓宦涣'],
  ['huang', '黄皇荒慌晃煌凰惶谎恍幌'],
  ['hui', '会回灰挥辉汇惠毁慧徽恢绘贿晖悔秽'],
  ['hun', '混魂婚昏浑荤馄'],
  ['huo', '或活火获货伙霍惑祸豁和'],
  ['ji', '机及级几计记基集己技极际即济继急纪击既鸡吉迹绩激积辑籍疾寄寂季剂挤稽肌'],
  ['jia', '家加价假佳架甲嘉夹驾嫁贾稼颊枷茄'],
  ['jian', '见间件建简检减坚监健兼剑肩鉴渐践舰尖艰荐剪键俭碱煎'],
  ['jiang', '将讲江奖降蒋疆姜酱匠浆僵'],
  ['jiao', '教交叫较脚角焦胶校骄郊觉搅缴椒轿矫'],
  ['jie', '接解界结节姐街借皆阶杰届截洁揭戒劫竭捷'],
  ['jin', '进金近仅今尽紧禁锦津斤劲晋谨筋巾襟'],
  ['jing', '经京精境警景竟静井敬镜径竞净惊晶睛靖'],
  ['jiong', '窘炯迥'],
  ['jiu', '就九酒久旧救究纠舅灸揪玖'],
  ['ju', '据局具举句巨居剧聚距拒俱惧菊矩橘拘鞠'],
  ['juan', '卷捐倦眷娟绢'],
  ['jue', '决绝觉角爵掘倔诀厥崛嚼'],
  ['jun', '军均俊君菌钧峻骏竣郡'],
  ['ka', '卡喀咖咔'],
  ['kai', '开凯慨楷铠揩'],
  ['kan', '看刊坎砍堪侃勘'],
  ['kang', '康抗扛炕慷糠'],
  ['kao', '考靠烤拷铐犒'],
  ['ke', '可科客克课刻颗壳柯渴棵苛咳磕'],
  ['ken', '肯啃恳垦'],
  ['keng', '坑吭铿'],
  ['kong', '空控孔恐倥'],
  ['kou', '口扣寇抠叩'],
  ['ku', '库苦哭酷枯裤窟'],
  ['kua', '跨夸垮胯挎'],
  ['kuai', '快块会筷侩脍'],
  ['kuan', '款宽髋'],
  ['kuang', '况矿狂框旷匡眶筐'],
  ['kui', '亏馈奎葵魁盔窥愧溃'],
  ['kun', '困昆坤捆琨鲲'],
  ['kuo', '扩阔括廓'],
  ['la', '拉啦辣腊蜡喇垃落'],
  ['lai', '来赖莱睐徕'],
  ['lan', '兰蓝览烂拦篮栏懒澜缆揽滥岚榄'],
  ['lang', '浪郎朗狼廊琅榔'],
  ['lao', '老劳牢捞烙姥涝唠酪'],
  ['le', '了乐勒肋'],
  ['lei', '类累雷泪垒蕾肋磊擂镭'],
  ['leng', '冷愣棱楞'],
  ['li', '里理力利立李例离历礼丽励黎粒璃厉厘莉梨隶犁俐'],
  ['lia', '俩'],
  ['lian', '联连练脸链恋炼莲廉怜帘敛涟'],
  ['liang', '量两良亮辆梁凉粮谅粱晾'],
  ['liao', '了料聊疗辽廖寥撩僚燎'],
  ['lie', '列烈裂劣猎咧'],
  ['lin', '林临邻琳淋麟磷霖赁凛'],
  ['ling', '领令另零灵龄岭凌玲铃陵菱伶聆'],
  ['liu', '流留六刘柳溜瘤硫琉榴'],
  ['long', '龙隆弄笼垄聋拢窿'],
  ['lou', '楼露漏陋娄搂篓喽'],
  ['lu', '路陆录鲁卢炉鹿露禄碌庐芦颅卤麓'],
  ['lv', '绿率旅律履虑吕铝侣屡滤驴缕'],
  ['luan', '乱卵峦挛滦'],
  ['lue', '略掠锊'],
  ['lun', '论轮伦仑沦抡'],
  ['luo', '罗落洛络裸螺逻骆萝锣箩'],
  ['ma', '吗妈马嘛麻骂码玛蚂'],
  ['mai', '买卖迈麦埋脉霾'],
  ['man', '满慢漫曼蛮瞒馒蔓'],
  ['mang', '忙芒盲茫莽氓'],
  ['mao', '毛猫贸冒帽貌矛茂卯锚铆'],
  ['me', '么麽'],
  ['mei', '没美每妹梅媒煤眉枚魅霉玫昧'],
  ['men', '们门闷懑扪'],
  ['meng', '梦蒙猛盟孟萌氓朦檬锰'],
  ['mi', '米密秘迷弥蜜觅谜靡眯泌'],
  ['mian', '面免棉眠绵缅勉冕'],
  ['miao', '秒苗妙描庙瞄渺缈'],
  ['mie', '灭蔑咩'],
  ['min', '民敏闽皿悯珉'],
  ['ming', '名明命鸣铭冥瞑茗'],
  ['miu', '谬'],
  ['mo', '么没摸模末莫默膜摩墨魔磨抹陌寞漠沫'],
  ['mou', '某谋眸牟'],
  ['mu', '目木母幕募墓牧穆慕亩姆牡睦'],
  ['na', '那拿哪纳钠娜呐'],
  ['nai', '乃奶耐奈氖艿'],
  ['nan', '南难男楠喃腩'],
  ['nang', '囊馕曩'],
  ['nao', '脑闹恼挠瑙孬'],
  ['ne', '呢讷'],
  ['nei', '内哪馁'],
  ['nen', '嫩恁'],
  ['neng', '能'],
  ['ni', '你尼呢拟逆泥妮倪霓匿腻'],
  ['nian', '年念粘碾廿捻撵'],
  ['niang', '娘酿'],
  ['niao', '鸟尿袅'],
  ['nie', '捏聂涅孽啮镊'],
  ['nin', '您'],
  ['ning', '宁凝拧柠狞泞'],
  ['niu', '牛纽扭钮妞拗'],
  ['nong', '农弄浓脓侬'],
  ['nu', '怒努奴弩'],
  ['nv', '女钕恧'],
  ['nuan', '暖'],
  ['nue', '虐疟'],
  ['nuo', '诺挪懦糯喏'],
  ['o', '哦噢喔'],
  ['ou', '欧偶呕藕鸥殴'],
  ['pa', '怕爬趴帕啪琶'],
  ['pai', '排派牌拍徘湃'],
  ['pan', '盘判潘盼攀畔叛磐'],
  ['pang', '旁庞胖乓膀滂'],
  ['pao', '跑炮泡抛袍刨咆狍'],
  ['pei', '配陪培佩赔沛裴胚'],
  ['pen', '喷盆湓'],
  ['peng', '朋碰鹏彭蓬棚膨捧烹砰'],
  ['pi', '批皮披匹脾疲啤僻屁譬毗坯辟'],
  ['pian', '片篇偏骗翩便'],
  ['piao', '票漂飘朴嫖瓢'],
  ['pie', '撇瞥'],
  ['pin', '品贫拼频聘拚嫔'],
  ['ping', '平评凭瓶屏萍苹坪乒'],
  ['po', '破迫婆坡泼颇魄珀泊'],
  ['pu', '普铺扑谱浦仆朴葡蒲曝瀑埔'],
  ['qi', '起其期气七器奇企齐弃妻骑旗棋岂汽启欺祈契戚漆'],
  ['qia', '恰洽掐卡'],
  ['qian', '前钱千签浅潜牵欠迁谦乾遣铅钳歉嵌纤'],
  ['qiang', '强抢枪墙腔呛羌蔷'],
  ['qiao', '桥巧乔悄敲瞧侨翘俏窍壳'],
  ['qie', '且切窃茄怯锲'],
  ['qin', '亲秦琴勤侵钦寝芹擒沁'],
  ['qing', '请清情青轻庆倾晴卿氢顷擎'],
  ['qiong', '穷琼穹邛'],
  ['qiu', '求球秋丘邱囚蚯泅'],
  ['qu', '去区取曲趋趣渠屈驱娶祛瞿躯'],
  ['quan', '全权圈泉劝券拳犬诠痊'],
  ['que', '却确缺雀瘸鹊阙'],
  ['qun', '群裙逡'],
  ['ran', '然染燃冉髯'],
  ['rang', '让嚷壤攘瓤'],
  ['rao', '绕扰饶娆'],
  ['re', '热惹喏'],
  ['ren', '人任认仁忍刃韧壬纫'],
  ['reng', '仍扔'],
  ['ri', '日'],
  ['rong', '容荣融蓉绒溶熔冗榕'],
  ['rou', '肉柔揉蹂'],
  ['ru', '如入乳儒辱汝茹褥'],
  ['ruan', '软阮'],
  ['rui', '瑞锐睿蕊芮'],
  ['run', '润闰'],
  ['ruo', '若弱偌'],
  ['sa', '撒洒萨仨'],
  ['sai', '赛塞腮噻'],
  ['san', '三散伞叁'],
  ['sang', '桑嗓丧'],
  ['sao', '扫嫂骚搔'],
  ['se', '色涩瑟塞'],
  ['sen', '森'],
  ['seng', '僧'],
  ['sha', '杀沙啥傻砂厦刹纱莎煞'],
  ['shai', '晒筛色'],
  ['shan', '山善闪衫删珊扇陕擅杉膳栅'],
  ['shang', '上商尚伤赏晌裳墒'],
  ['shao', '少绍烧稍邵勺哨梢韶'],
  ['she', '社设蛇射舍摄涉舌奢赦佘'],
  ['shen', '身什神深审申甚沈伸慎肾参绅婶'],
  ['sheng', '生声省胜升盛圣剩绳牲笙甥'],
  ['shi', '是时十事使市式识实始世师史示石食视试势士施室诗适释氏失湿驶拾'],
  ['shou', '手受收首守售寿授兽瘦狩'],
  ['shu', '书数术输树属熟束述署殊舒鼠叔暑枢蜀疏'],
  ['shua', '刷耍唰'],
  ['shuai', '帅摔甩率衰'],
  ['shuan', '栓拴涮'],
  ['shuang', '双爽霜孀'],
  ['shui', '水税睡说谁'],
  ['shun', '顺瞬舜吮'],
  ['shuo', '说硕烁朔铄'],
  ['si', '四思斯司私死似丝寺撕肆饲嗣'],
  ['song', '送松宋颂诵耸嵩怂'],
  ['sou', '搜艘嗽叟馊'],
  ['su', '速素苏诉俗宿塑肃粟酥溯'],
  ['suan', '算酸蒜狻'],
  ['sui', '岁随虽碎穗遂隧祟'],
  ['sun', '孙损笋荪榫'],
  ['suo', '所索缩锁梭琐唆娑'],
  ['ta', '他她它踏塔塌榻沓蹋'],
  ['tai', '太台态泰抬胎汰苔'],
  ['tan', '谈探叹坦坛滩贪摊碳弹谭毯潭'],
  ['tang', '堂唐糖汤躺趟塘烫倘棠膛'],
  ['tao', '套讨逃桃陶涛掏淘滔萄'],
  ['te', '特忒'],
  ['teng', '疼腾藤誊'],
  ['ti', '体题提替梯踢剃蹄涕剔惕'],
  ['tian', '天田填甜添舔恬腆'],
  ['tiao', '条调跳挑眺迢窕'],
  ['tie', '铁贴帖'],
  ['ting', '听停庭挺厅亭婷廷艇'],
  ['tong', '同通统痛童铜桶桐筒彤捅'],
  ['tou', '头投透偷骰'],
  ['tu', '图土突途徒兔涂吐屠秃凸'],
  ['tuan', '团湍抟'],
  ['tui', '推退腿褪颓'],
  ['tun', '吞屯褪囤臀'],
  ['tuo', '托脱拖妥拓驼陀椭唾鸵'],
  ['wa', '瓦挖娃袜哇洼蛙'],
  ['wai', '外歪崴'],
  ['wan', '完万晚玩弯湾碗挽腕顽丸宛婉惋'],
  ['wang', '王往网望忘亡旺汪枉妄'],
  ['wei', '为位未微委维伟围卫威味唯谓尾违危慰魏伪喂苇纬畏蔚'],
  ['wen', '问文闻温稳吻纹蚊雯瘟'],
  ['weng', '翁嗡瓮'],
  ['wo', '我握窝卧沃蜗斡'],
  ['wu', '无五物务武午舞误屋吴污吾悟雾伍乌呜勿侮坞'],
  ['xi', '西系细习喜息希析席吸戏洗悉锡溪惜稀袭媳膝熙'],
  ['xia', '下夏吓峡霞辖瞎虾侠狭厦'],
  ['xian', '先线县现显限险献鲜闲仙陷贤弦咸纤羡宪衔嫌'],
  ['xiang', '想向相象像项响香乡享箱详祥湘巷橡'],
  ['xiao', '小笑校消效销晓肖萧孝啸宵削霄逍'],
  ['xie', '写些谢协鞋斜血械携邪泄歇胁蝎屑'],
  ['xin', '新心信欣辛薪芯馨鑫衅'],
  ['xing', '行性型形星兴幸姓醒邢杏刑'],
  ['xiong', '雄兄胸凶熊匈'],
  ['xiu', '修秀休袖羞绣宿锈嗅'],
  ['xu', '需许续序须虚徐蓄叙旭绪恤墟'],
  ['xuan', '选宣旋悬玄轩喧眩绚'],
  ['xue', '学雪血穴削靴薛'],
  ['xun', '寻讯训迅询循巡旬勋逊熏'],
  ['ya', '亚压呀牙雅押鸦芽崖哑讶'],
  ['yan', '研眼言验严演烟沿延盐炎颜燕厌宴岩掩艳彦雁焰'],
  ['yang', '样养阳杨洋央扬羊仰氧痒漾'],
  ['yao', '要药摇遥腰咬耀姚邀窑谣妖'],
  ['ye', '也业页夜野叶爷液冶耶椰腋'],
  ['yi', '一以已意义易议依移医乙艺益异衣遗宜仪亿译忆疑亦翼伊'],
  ['yin', '因引银印音饮隐阴姻吟殷尹瘾'],
  ['ying', '应英影营迎硬映赢鹰颖莹萤'],
  ['yo', '哟唷'],
  ['yong', '用永拥勇涌庸佣咏泳蛹'],
  ['you', '有又由友右游优油邮幼尤忧悠诱佑'],
  ['yu', '于与语育余遇雨鱼域玉预欲予宇羽愈誉渔豫郁狱御'],
  ['yuan', '原员院远愿源圆园元缘援怨苑冤'],
  ['yue', '月越约乐阅跃悦岳粤曰'],
  ['yun', '云运允韵蕴孕晕匀耘'],
  ['za', '杂砸咋匝咂'],
  ['zai', '在再载灾仔栽宰'],
  ['zan', '赞暂咱攒簪'],
  ['zang', '藏脏葬赃臧'],
  ['zao', '早造遭糟灶枣噪躁凿'],
  ['ze', '则责泽择咋啧仄'],
  ['zei', '贼'],
  ['zen', '怎谮'],
  ['zeng', '增曾赠憎缯'],
  ['zha', '查扎炸诈眨渣榨乍闸栅札'],
  ['zhai', '摘宅债窄寨斋'],
  ['zhan', '展站占战粘沾斩盏湛栈瞻'],
  ['zhang', '张章长掌丈涨账障仗胀彰杖'],
  ['zhao', '找照招赵朝召着罩兆昭爪'],
  ['zhe', '这者着折哲浙遮辙蔗'],
  ['zhen', '真阵镇针震诊珍振圳枕侦贞甄'],
  ['zheng', '正政整证争征郑挣症睁蒸拯筝'],
  ['zhi', '之只知至制直指治职志支值织质止纸智致置执址枝脂'],
  ['zhong', '中种重众终钟忠仲肿衷'],
  ['zhou', '周州洲舟骤轴宙粥昼肘皱'],
  ['zhu', '主住注助著猪珠竹诸逐驻筑煮柱祝朱嘱'],
  ['zhua', '抓爪'],
  ['zhuai', '拽'],
  ['zhuan', '转专传赚砖撰篆'],
  ['zhuang', '装状庄壮撞桩妆'],
  ['zhui', '追坠缀锥赘'],
  ['zhun', '准谆'],
  ['zhuo', '桌着捉卓浊灼拙琢酌'],
  ['zi', '子字自资紫姿滋仔兹咨籽'],
  ['zong', '总宗纵综踪棕'],
  ['zou', '走奏揍邹'],
  ['zu', '组足族祖租阻卒'],
  ['zuan', '钻攥纂'],
  ['zui', '最罪嘴醉'],
  ['zun', '尊遵樽'],
  ['zuo', '作做坐左昨座佐琢']
]

let pinyinCharMap: Map<string, string> | null = null
const pinyinTextCache = new Map<string, PinyinTokens>()

export async function ensurePinyinModuleLoaded(): Promise<void> {
  ensureCompactPinyinMap()
}

export function isPinyinModuleLoaded(): boolean {
  return pinyinCharMap !== null
}

export function buildPinyinTokensSync(values: unknown[]): PinyinTokens {
  const full = new Set<string>()
  const initials = new Set<string>()

  for (const value of values) {
    const text = String(value || '')
    const matches = text.match(/[㐀-鿿]+/gu) || []
    for (const match of matches) {
      const tokens = getCompactPinyinTokens(match)
      for (const token of tokens.full) {
        full.add(token)
      }
      for (const token of tokens.initials) {
        initials.add(token)
      }
    }
  }

  return {
    full: [...full],
    initials: [...initials]
  }
}

function getPinyinSourceValues(target: PinyinEnrichTarget): unknown[] {
  return [
    target.title,
    target.path || '',
    ...(target.tagTopics || []),
    ...(target.tagTags || []),
    ...(target.tagAliases || [])
  ]
}

function applyPinyinTokens(target: PinyinEnrichTarget, tokens: PinyinTokens): boolean {
  const baseSearchText = target.pinyinBaseSearchText ?? target.searchText
  target.pinyinBaseSearchText = baseSearchText
  target.pinyinEnriched = true

  const newFull = tokens.full
  const newInitials = tokens.initials
  if (!newFull.length && !newInitials.length) {
    target.tagPinyinFull = []
    target.tagPinyinInitials = []
    target.searchText = baseSearchText
    target.searchTextCompact = normalizeSearchTextCompact(baseSearchText)
    return false
  }

  target.tagPinyinFull = newFull
  target.tagPinyinInitials = newInitials
  const enrichedSegment = [...newFull, ...newInitials].join(' ')
  target.searchText = enrichedSegment ? `${baseSearchText} ${enrichedSegment}`.trim() : baseSearchText
  target.searchTextCompact = normalizeSearchTextCompact(target.searchText)
  return true
}

export async function enrichBookmarkPinyinTokens(target: PinyinEnrichTarget): Promise<boolean> {
  const tokens = buildPinyinTokensSync(getPinyinSourceValues(target))
  return applyPinyinTokens(target, tokens)
}

function defaultYieldWork(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

export async function enrichPinyinTokensCooperatively(
  targets: PinyinEnrichTarget[],
  options: CooperativeEnrichOptions = {}
): Promise<{ processed: number; enriched: number; aborted: boolean }> {
  if (!targets.length) {
    return { processed: 0, enriched: 0, aborted: false }
  }

  const isActive = options.isActive ?? (() => true)
  const yieldWork = options.yieldWork ?? defaultYieldWork
  const batchSize = Math.max(50, options.batchSize ?? 250)
  const total = targets.length

  let processed = 0
  let enriched = 0

  const processBatch = async (index = 0): Promise<{ processed: number; enriched: number; aborted: boolean }> => {
    if (index >= targets.length) {
      return { processed, enriched, aborted: false }
    }
    if (!isActive()) {
      return { processed, enriched, aborted: true }
    }

    const end = Math.min(index + batchSize, targets.length)
    for (let cursor = index; cursor < end; cursor += 1) {
      const target = targets[cursor]
      const tokens = buildPinyinTokensSync(getPinyinSourceValues(target))
      if (applyPinyinTokens(target, tokens)) {
        enriched += 1
      }
      processed += 1
    }

    if (options.onProgress) {
      options.onProgress(processed, total)
    }

    if (end < targets.length) {
      await yieldWork()
      return processBatch(end)
    }

    return { processed, enriched, aborted: false }
  }

  return processBatch()
}

function getCompactPinyinTokens(text: string): PinyinTokens {
  const normalized = String(text || '')
  const cached = pinyinTextCache.get(normalized)
  if (cached) {
    return cached
  }

  const map = ensureCompactPinyinMap()
  const fullParts: string[] = []
  const initialParts: string[] = []
  for (const char of normalized) {
    const syllable = map.get(char)
    if (!syllable) {
      continue
    }
    fullParts.push(syllable)
    initialParts.push(syllable[0] || '')
  }

  const result = {
    full: fullParts.length ? [normalizeText(fullParts.join(''))] : [],
    initials: initialParts.length ? [normalizeText(initialParts.join(''))] : []
  }
  pinyinTextCache.set(normalized, result)
  if (pinyinTextCache.size > 2048) {
    pinyinTextCache.delete(pinyinTextCache.keys().next().value || '')
  }
  return result
}

function ensureCompactPinyinMap(): Map<string, string> {
  if (pinyinCharMap) {
    return pinyinCharMap
  }

  const nextMap = new Map<string, string>()
  for (const [syllable, chars] of COMPACT_PINYIN_GROUPS) {
    for (const char of chars) {
      if (!nextMap.has(char)) {
        nextMap.set(char, syllable)
      }
    }
  }
  pinyinCharMap = nextMap
  return nextMap
}
