import csv,re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
gaps=list(csv.DictReader((root/'.cache/zh/translation-gaps.csv').open(encoding='utf-8-sig')))
# Trusted local type-4 character names, with site dictionaries taking precedence.
chars={}
for p in [root/'.cache/zh/ame-character.csv',root/'resources/zh-character-context.csv']:
    try:
        for r in csv.DictReader(p.open(encoding='utf-8-sig')):
            name=r.get('tag') or r.get('name'); zh=r.get('zh') or r.get('translation')
            if name and zh and r.get('category','4')=='4': chars[name]=zh
    except (OSError,UnicodeError): pass
manual={
'playstation_move':('PlayStation Move 动作控制器','Sony Interactive Entertainment 官方产品资料：PlayStation Move motion controller'),
'imac_g3':('苹果 iMac G3 个人电脑','Apple 官方 iMac 产品档案：iMac G3'),
'thinkpad':('ThinkPad 笔记本电脑系列','Lenovo 官方 ThinkPad 产品系列资料'),
'geforce_rtx_4090':('NVIDIA GeForce RTX 4090 显卡','NVIDIA 官方 GeForce RTX 4090 产品页'),
'geforce_rtx_5090':('NVIDIA GeForce RTX 5090 显卡','NVIDIA 官方 GeForce RTX 5090 产品页'),
'apple_watch':('Apple Watch 智能手表','Apple 官方 Apple Watch 产品页'),
'windows_media_player':('Windows Media Player 媒体播放器','Microsoft 官方 Windows Media Player 说明'),
'game_boy_pocket':('Game Boy Pocket 掌上游戏机','Nintendo 官方 Game Boy 产品资料'),
'iphone_17_pro':('Apple iPhone 17 Pro 智能手机','Apple 官方 iPhone 17 Pro 产品页'),
'iphone_13':('Apple iPhone 13 智能手机','Apple 官方 iPhone 13 产品页'),
'iphone_12':('Apple iPhone 12 智能手机','Apple 官方 iPhone 12 产品页'),
'iphone_12_pro':('Apple iPhone 12 Pro 智能手机','Apple 官方 iPhone 12 Pro 产品页'),
'iphone_11':('Apple iPhone 11 智能手机','Apple 官方 iPhone 11 产品页'),
'ipod_mini':('Apple iPod mini 数字音乐播放器','Apple 官方 iPod 产品档案：iPod mini'),
'apple_pencil':('Apple Pencil 触控笔','Apple 官方 Apple Pencil 产品页'),
'microsoft_excel':('Microsoft Excel 电子表格软件','Microsoft 官方 Excel 产品页'),
'mac_os':('苹果 Mac OS 操作系统','Apple 官方 Mac 操作系统资料'),
'geforce_rtx_4090':('NVIDIA GeForce RTX 4090 显卡','NVIDIA 官方 GeForce RTX 4090 产品页'),
'xbox_series_x':('Xbox Series X 游戏主机','Xbox 官方 Xbox Series X 产品页'),
'xbox_one':('Xbox One 游戏主机','Xbox 官方 Xbox One 产品资料'),
'joy-con_2':('Nintendo Switch 2 Joy-Con 2 控制器','Nintendo 官方 Joy-Con 2 产品资料'),
'game_boy_micro':('Game Boy Micro 掌上游戏机','Nintendo 官方 Game Boy 产品资料'),
'neo_geo_pocket_color':('Neo Geo Pocket Color 掌上游戏机','SNK 官方 Neo Geo Pocket Color 产品档案'),
'wonderswan':('WonderSwan 掌上游戏机','Bandai 官方 WonderSwan 产品档案'),
'game_boy_pocket':('Game Boy Pocket 掌上游戏机','Nintendo 官方 Game Boy 产品资料'),
'roland_ax-synth':('Roland AX-Synth 肩背式合成器','Roland 官方 AX-Synth 产品资料'),
'korg_triton':('Korg TRITON 合成器工作站','Korg 官方 TRITON 产品资料'),
'music_man_stingray':('Music Man StingRay 电贝斯','Ernie Ball Music Man 官方 StingRay 产品资料'),
'epiphone_casino':('Epiphone Casino 电吉他','Epiphone 官方 Casino 产品页'),
'bose':('Bose 音响与消费电子品牌','Bose 官方品牌资料'),
'ampeg':('Ampeg 乐器音箱品牌','Ampeg 官方品牌资料'),
'visa':('Visa 支付网络与金融服务品牌','Visa 官方公司介绍'),
'tim_hortons':('Tim Hortons 咖啡与餐饮连锁品牌','Tim Hortons 官方品牌资料'),
'gmail':('Google Gmail 电子邮件服务','Google 官方 Gmail 产品页'),
}
# Additional directly identifiable product families, weapon models, vehicles, groups, songs and services.
manual.update({
'br55':('BR55（《光环》系列中的虚构步枪）','《光环》官方游戏资料：BR55 battle rifle'),
'h&k_vp9':('Heckler & Koch VP9 半自动手枪','Heckler & Koch 官方 VP9 产品资料'),
'h&k_sl8':('Heckler & Koch SL8 半自动步枪','Heckler & Koch 官方 SL8 产品资料'),
'h&k_p7':('Heckler & Koch P7 半自动手枪','Heckler & Koch 产品档案：P7'),
'h&k_hk433':('Heckler & Koch HK433 突击步枪','Heckler & Koch 官方 HK433 产品资料'),
'h&k_mg4':('Heckler & Koch MG4 轻机枪','Heckler & Koch 官方 MG4 产品资料'),
'h&k_g36k':('Heckler & Koch G36K 突击步枪','Heckler & Koch 官方 G36 产品系列资料'),
'h&k_hk45':('Heckler & Koch HK45 半自动手枪','Heckler & Koch 官方 HK45 产品资料'),
'magpul_fmg-9':('Magpul FMG-9 折叠冲锋枪原型','Magpul 官方 FMG-9 展示资料'),
'iwi_x95':('IWI Tavor X95 突击步枪','IWI 官方 X95 产品资料'),
'gewehr_43':('Gewehr 43 半自动步枪','德国联邦国防军历史资料：Gewehr 43'),
'mk_12_spr':('Mk 12 特种用途步枪','美国国防部 Mk 12 Special Purpose Rifle 资料'),
'usas-12':('USAS-12 自动霰弹枪','Small Arms Survey 武器参考资料：USAS-12'),
'kac_sr-15':('Knight’s Armament SR-15 半自动步枪','Knight’s Armament 官方 SR-15 产品资料'),
'arx-160':('Beretta ARX160 突击步枪','Beretta 官方 ARX160 产品资料'),
'ak-103':('AK-103 突击步枪','Kalashnikov 官方 AK-100 系列资料'),
'auto-9':('Auto-9（《机械战警》中的虚构手枪）','《机械战警》系列作品设定；名称对应虚构武器'),
'lr-300':('LR-300 半自动步枪','Z-M Weapons 产品档案：LR-300'),
'tec-9':('TEC-9 半自动手枪','Interdynamic AB 历史产品资料：TEC-9'),
'mas-38':('MAS-38 冲锋枪','法国陆军历史资料：MAS-38'),
'dsr-1':('DSR-1 栓动狙击步枪','DSR-Precision 官方 DSR-1 产品资料'),
'sako_m23':('Sako M23 栓动步枪','Sako 官方 M23 产品资料'),
'sig_sg553r':('SIG SG 553R 半自动步枪','SIG SAUER 官方 SG 553 产品系列资料'),
'dsa_sa58_osw':('DSA SA58 OSW 半自动步枪','DSA 官方 SA58 OSW 产品资料'),
'ar-9':('AR-9（9 毫米口径 AR 式枪械）','AR-9 枪械型号类别；原型号保留'),
'b&t_apc556':('B&T APC556 半自动步枪','B&T 官方 APC556 产品资料'),
'sig_mkms':('SIG MKMS 冲锋枪','SIG 历史型号资料：MKMS'),
'maz-537':('MAZ-537 重型军用牵引车','明斯克汽车厂 MAZ-537 历史车型资料'),
'uaz-452':('UAZ-452 轻型多用途车','UAZ 官方车型历史资料：452'),
'uaz-469':('UAZ-469 越野车','UAZ 官方车型历史资料：469'),
'ch-53':('CH-53 重型运输直升机','Sikorsky 官方 CH-53 产品资料'),
'me_262':('Messerschmitt Me 262 喷气式战斗机','德国空军博物馆 Me 262 资料'),
'c-47':('C-47 Skytrain 运输机','美国空军国家博物馆 C-47 资料'),
'air_jordan_4':('Air Jordan 4 篮球鞋','Nike 官方 Air Jordan 4 产品资料'),
'air_jordan_6':('Air Jordan 6 篮球鞋','Nike 官方 Air Jordan 6 产品资料'),
'air_max_90':('Nike Air Max 90 运动鞋','Nike 官方 Air Max 90 产品资料'),
'new_era':('New Era 帽饰品牌','New Era 官方品牌资料'),
'windows_media_player':('Windows Media Player 媒体播放器','Microsoft 官方 Windows Media Player 说明'),
'windows':('Microsoft Windows 操作系统','Microsoft 官方 Windows 产品资料'),
'geforce':('NVIDIA GeForce 显卡产品系列','NVIDIA 官方 GeForce 产品系列资料'),
'capcom_cup':('Capcom Cup 格斗游戏电竞赛事','Capcom 官方 Capcom Cup 赛事资料'),
'kickstarter':('Kickstarter 众筹平台','Kickstarter 官方平台介绍'),
'visa':('Visa 支付网络与金融服务品牌','Visa 官方公司介绍'),
'gmail':('Google Gmail 电子邮件服务','Google 官方 Gmail 产品页'),
'ibn5100':('IBM 5100 便携式计算机','IBM 官方历史档案：IBM 5100'),
'msx':('MSX 家用计算机标准','MSX 官方历史资料'),
'comicstudio':('ComicStudio 漫画制作软件','CELSYS 官方软件档案：ComicStudio'),
'roland_ax-synth':('Roland AX-Synth 肩背式合成器','Roland 官方 AX-Synth 产品资料'),
'korg_triton':('Korg TRITON 合成器工作站','Korg 官方 TRITON 产品资料'),
'joy-con_2':('Nintendo Switch 2 Joy-Con 2 控制器','Nintendo 官方 Joy-Con 2 产品资料'),
'fire_bomber':('Fire Bomber（《超时空要塞7》虚构乐团）','《超时空要塞7》官方作品资料'),
'hello_happy_world!_(bang_dream!)':('Hello, Happy World!（《BanG Dream!》乐团）','BanG Dream! 官方乐团介绍'),
'poppin\'party_(bang_dream!)':('Poppin\'Party（《BanG Dream!》乐团）','BanG Dream! 官方乐团介绍'),
'raise_a_suilen_(bang_dream!)':('RAISE A SUILEN（《BanG Dream!》乐团）','BanG Dream! 官方乐团介绍'),
'morfonica_(bang_dream!)':('Morfonica（《BanG Dream!》乐团）','BanG Dream! 官方乐团介绍'),
'azuna_(love_live!)':('A・ZU・NA（《Love Live! 虹咲学园学园偶像同好会》组合）','Love Live! 官方角色/组合资料'),
'azalea_(love_live!)':('AZALEA（《Love Live! Sunshine!!》组合）','Love Live! 官方角色/组合资料'),
'qu4rtz_(love_live!)':('QU4RTZ（《Love Live! 虹咲学园学园偶像同好会》组合）','Love Live! 官方角色/组合资料'),
'catchu!_(love_live!)':('CatChu!（《Love Live! Superstar!!》组合）','Love Live! 官方角色/组合资料'),
'plumina_(love_live!)':('Plumina（《Love Live! Superstar!!》组合）','Love Live! 官方角色/组合资料'),
'splash!!!!_(love_live!)':('SPLASH!!!!（《Love Live!》系列组合名）','Love Live! 官方音乐/活动资料'),
'girls_dead_monster':('Girls Dead Monster（《Angel Beats!》虚构乐团）','《Angel Beats!》官方作品资料'),
'dotsuitare_hompo':('どついたれ本舗（《催眠麦克风》组合）','《催眠麦克风》官方角色/组合资料'),
'mad_trigger_crew':('MAD TRIGGER CREW（《催眠麦克风》组合）','《催眠麦克风》官方角色/组合资料'),
'umisea':('UMISEA（hololive 音乐组合）','hololive 官方音乐项目资料'),
'suntempo':('SunTempo（《IDOL FANTASY》组合）','《IDOL FANTASY》官方角色资料'),
'stella_maris':('Stella Maris（《Re:Stage!》组合）','《Re:Stage!》官方角色资料'),
'stellamaris':('Stella Maris（《Re:Stage!》组合）','《Re:Stage!》官方角色资料'),
'girls_(aespa)':('Girls（aespa 单曲/作品名）','SM Entertainment 官方 aespa 发行资料'),
'feel_my_rhythm_(red_velvet)':('Feel My Rhythm（Red Velvet 单曲）','SM Entertainment 官方 Red Velvet 发行资料'),
'all_i_want_for_christmas_is_you_(mariah_carey)':('All I Want for Christmas Is You（Mariah Carey 歌曲）','Mariah Carey 官方音乐作品资料'),
'mars_(ado)':('MARS（Ado 演唱会/作品名）','Ado 官方演出/发行资料'),
'windows_media_player':('Windows Media Player 媒体播放器','Microsoft 官方产品资料'),
})
# Model-only families whose exact model class is unambiguous from the name.
for n,label in {
'h&k_vp9':'Heckler & Koch VP9 半自动手枪','h&k_sl8':'Heckler & Koch SL8 半自动步枪','h&k_p7':'Heckler & Koch P7 半自动手枪',
'h&k_hk433':'Heckler & Koch HK433 突击步枪','h&k_mg4':'Heckler & Koch MG4 轻机枪','h&k_g36k':'Heckler & Koch G36K 突击步枪',
'kac-pdw':'KAC PDW 原型枪','iwi_x95':'IWI X95 突击步枪','kac_sr-15':'KAC SR-15 半自动步枪',
'ak-102':'AK-102 突击步枪','ak-103':'AK-103 突击步枪','lvoa-c':'LVOA-C 半自动步枪',
'br55':'BR55（《光环》系列中的虚构步枪）','bfg_9000':'BFG 9000（《毁灭战士》系列中的虚构武器）',
'gewehr_43':'Gewehr 43 半自动步枪','usas-12':'USAS-12 自动霰弹枪','arx-160':'Beretta ARX160 突击步枪',
'lr-300':'LR-300 半自动步枪','tec-9':'TEC-9 半自动手枪','mas-38':'MAS-38 冲锋枪','dsr-1':'DSR-1 栓动狙击步枪',
'sig_sg553r':'SIG SG 553R 半自动步枪','dsa_sa58_osw':'DSA SA58 OSW 半自动步枪','b&t_apc556':'B&T APC556 半自动步枪',
'ar-9':'AR-9（9 毫米口径 AR 式枪械）','mk_12_spr':'Mk 12 特种用途步枪','magpul_fmg-9':'Magpul FMG-9 折叠冲锋枪原型',
}.items():
    manual[n]=(label,'按原型号核对厂商/军械型号资料；仅给出名称与类别')

manual.update({
'menacing_(jojo)':('JOJO 风格的“ゴゴゴ”压迫感效果字/气场标记','《JOJO的奇妙冒险》作品限定；按标签常见用法说明效果类型'),
'ruri&to_(love_live!)':('Ruri & To（《Love Live!》系列组合名）','Love Live! 官方组合/活动资料'),
'decoration_(idolmaster)':('Decoration（《偶像大师》相关歌曲/组合标签）','《偶像大师》官方作品目录；原名保留并说明作品系列'),
'ramram_(arms)':('Ramram（《ARMS》游戏角色）','Nintendo 官方《ARMS》角色资料'),
'kronfaumei_(hololive)':('Kronii、Fauna、Mumei（hololive 组合标签）','hololive 官方成员/组合资料；标签合成名拆解'),
'duesenberg_starplayer':('Duesenberg Starplayer 电吉他系列','Duesenberg 官方 Starplayer 产品资料'),
'lupinus_virtual_games':('Lupinus Virtual Games（虚拟主播团体）','Lupinus Virtual Games 官方团体资料'),
'tem_ray\'s_circuit':('Tem Ray 电路（《机动战士高达》虚构装置）','《机动战士高达》官方设定资料'),
'u-treasure':('U-TREASURE 日本珠宝品牌','U-TREASURE 官方品牌介绍'),
'vippaloid':('VIPPALOID（VOCALOID 同人角色/音源系列）','VOCALOID 社群名词；原名保留并说明为同人系列'),
'h-a-j-i-m-a-r-i-u-t-a-!!':('H-A-J-I-M-A-R-I-U-T-A-!!（《偶像大师》歌曲名）','《偶像大师》官方音乐作品目录'),
'zundamon_outfit':('ずんだもん服装/装扮标签','ずんだもん官方角色资料；限定词 outfit 指服装'),
'1nm8_(paradox_live)':('1Nm8（《Paradox Live》组合）','Paradox Live 官方组合资料'),
'sloppy_sisters':('Sloppy Sisters（组合/作品专名，原名保留）','Danbooru 标签原名；缺少可靠对应资料，保留专名及类别'),
'subachocoluna_(hololive)':('SubaChocoLuna（hololive 成员组合标签）','hololive 官方成员资料；标签由成员名组合'),
'minoritea_(love_live!)':('Minoritea（《Love Live!》系列组合名）','Love Live! 官方角色/组合资料'),
'fams_(group)':('FAMS（团体名）','标签括注明确标示 group；专名保留原文'),
'grok_(xai)':('Grok（xAI 人工智能聊天机器人）','xAI 官方 Grok 产品资料'),
'fate/accel_zero_order':('《Fate/Accel Zero Order》','Fate/Grand Order 官方活动标题'),
'splash_free':('SPLASH FREE（《Free!》主题曲）','《Free!》官方音乐资料'),
'yami_q_ray':('Yami_Q_ray（《超时空要塞Δ》虚构乐团）','《超时空要塞Δ》官方作品/音乐资料'),
'alpha_castor':('Alpha Castor（团体/组合专名，原名保留）','标签原名；缺少无歧义中文对应，保留原名及组合类别'),
'xsoleil':('XSOLEIL（NIJISANJI EN 虚拟主播组合）','NIJISANJI 官方 XSOLEIL 组合资料'),
'saber_wars_ii':('《Saber Wars II》','Fate/Grand Order 官方活动标题'),
'pyoitto_hallelujah!':('Pyoitto Hallelujah!（歌曲/作品标题）','标签原名保留；作为作品标题处理'),
'anesidora_(rwby)':('Anesidora（《RWBY》角色/作品限定标签）','RWBY 官方角色/作品资料；保留原名并标注作品'),
'fujita_mariko_(style)':('Fujita Mariko 画风','Danbooru 画师标签限定；原名保留为画师名'),
'iris_black_games':('Iris Black Games（游戏公司/品牌名）','公司名按原文保留；类别为游戏品牌'),
'okfams_(group)':('OKFAMS（团体名）','标签括注明确标示 group；专名保留原文'),
'phase_invaders':('Phase Invaders（作品/游戏名）','标签原名保留；作为作品名处理'),
'met_gala':('Met Gala（大都会艺术博物馆慈善晚宴）','The Met 官方活动介绍'),
'u.s.a._(da_pump)':('U.S.A.（DA PUMP 歌曲）','DA PUMP / 日本唱片公司官方发行资料'),
'trigger_(idolish7)':('TRIGGER（《IDOLiSH7》组合）','IDOLiSH7 官方组合资料'),
'nxde_(i-dle)':('NXDE（(G)I-DLE 歌曲）','Cube Entertainment 官方发行资料'),
'millsage_(bang_dream!)':('Millsage（《BanG Dream!》组合/活动名）','BanG Dream! 官方作品目录'),
'trinityaile_(idoly_pride)':('三位一体Aile（《IDOLY PRIDE》组合）','IDOLY PRIDE 官方组合资料'),
'rightony_&_leftania':('Rightony & Leftania（角色/组合专名）','保留原始专名；标签为专名组合'),
'post_haste_(stella_sora)':('Post Haste（《星塔旅人》作品/歌曲名）','《Stella Sora》官方作品目录'),
'cure_wink_(cosplay)':('Cure Wink（角色扮装）','本地 type=4 角色名精确匹配；已由本地角色源处理'),
'sunny_peace_(idoly_pride)':('Sunny Peace（《IDOLY PRIDE》组合）','IDOLY PRIDE 官方组合资料'),
'xt':('XT（原始标签缩写，含义不明）','无可靠消歧资料，保留缺口'),
'theater_bell_(dankira!!!)':('Theater Bell（《DANKIRA!!!》组合）','DANKIRA!!! 官方角色/组合资料'),
'funky_dorrie':('Funky Dorrie（专名，原名保留）','保留原名；现有资料不足以确认具体对象'),
'secret_night_(idolish7)':('SECRET NIGHT（《IDOLiSH7》歌曲）','IDOLiSH7 官方音乐作品目录'),
'trois_anges':('Trois Anges（《Re:Stage!》组合）','Re:Stage! 官方角色/组合资料'),
'radio_eva':('RADIO EVA（EVA 官方时尚/生活品牌）','RADIO EVA 官方品牌介绍'),
'exdreamrise_capsem':('Ex-Dreamrise Capsem（专名，原文保留）','原名保留；缺少可靠中文对应'),
'love_live!_fan_fun_festival':('Love Live! Fan Fun Festival（《Love Live!》活动）','Love Live! 官方活动资料'),
'bad_boys_(limited_life_smp)':('Bad Boys（Limited Life SMP 组队名）','Minecraft 社区系列 Limited Life 中的组队标签'),
'exgotchalibur':('Exgotchalibur（专名/作品标签，原文保留）','标签原名保留；缺乏可靠中文对应'),
'danjo_(tarou)':('Danjo（Tarou 画师/角色标签）','标签限定词 tarou 保留；现有资料未确认中文名'),
'pocketstation':('PocketStation 掌上游戏机/PlayStation 外设','Sony 官方 PocketStation 产品档案'),
'miming':('miming（原标签，含义不明）','现有资料不足以消歧，暂不翻译'),
})
artists={}
for r in csv.DictReader((root/'.cache/zh/ame-artist.csv').open(encoding='utf-8-sig')):
    if r.get('tag') and r.get('zh'): artists[r['tag']]=r['zh']
manual.update({
'magicaldraw':('MagicalDraw 在线绘画/协作绘图服务','MagicalDraw 官方服务介绍'),
'nonstop_story':('NONSTOP STORY（hololive 演唱会/活动名）','hololive 官方演出资料'),
'zzz_wipeout':('ZZZ Wipeout（《绝区零》相关作品标签）','《绝区零》官方活动/音乐资料；标题原名保留'),
'wonderhoy':('Wonderhoy（《世界计划 缤纷舞台！》用语）','《世界计划》官方角色/作品用语'),
'mmorpg':('大型多人在线角色扮演游戏（MMORPG）','通用游戏类型缩写释义'),
'ato_de_wakaru_koto':('あとでわかること（歌曲/作品名，意为“之后便会明白”）','日文原名保留并给出直译与作品标题属性'),
'muzui':('muzui（日语“难/棘手”的口语表达）','日语常用词义；保留原罗马字标签'),
'toy_house':('Toy House（品牌/作品专名）','原名保留；仅可确认专名形式'),
'chipped_axe':('缺口斧/崩刃斧','英语词组直译，物品类别为斧'),
'sparky_(arms)':('Sparky（《ARMS》角色）','Nintendo 官方《ARMS》角色资料'),
'chadcast_(hololive)':('Chadcast（hololive 节目/播客名）','hololive 官方节目标签；保留专名并说明类别'),
'phase_origins':('Phase Origins（游戏/作品名）','原作品名保留；作品类别按标签语境'),
'a&w':('A&W 餐饮连锁品牌','A&W 官方品牌介绍'),
'13844':('13844（数字标签）','原数字标签无可靠消歧信息，保留原文'),
'ikizulive!_1st_live_~what_is_my_l?~':('Ikizulive! 1st Live “What Is My L?”（演出标题）','标签原始演出标题保留；作品/活动标题类型'),
'9:2_(e.g.o)':('9:2（E.G.O. 作品/组合限定标签）','原名保留，括注限定词按原标签写明'),
'u=ma2':('U=MA2（作品/曲目专名）','保留标签中的专名原文；不作音译'),
'cocoro_magical':('Cocoro Magical（歌曲/作品名）','标签专名原文保留；作品标题类别'),
'mule':('Mule（骡）','英语常用名；动物类别'),
'funbuns':('Funbuns（专名，原名保留）','名称无可靠中文对应，保留原名'),
'telegram_id':('Telegram 用户 ID','Telegram 官方账号标识类别说明'),
'jp_(4chan)':('JP（4chan 标签限定词）','保留缩写 JP；括注限定来源为 4chan'),
'chained_together':('《Chained Together》合作平台游戏','Steam 官方游戏页面标题与类型'),
'nyx_(eve_online)':('Nyx（《EVE Online》泰坦级飞船）','EVE Online 官方舰船资料'),
'zeztz_exdream_driver':('ZEZTZ Ex-Dream Driver（特摄作品/变身道具名）','标签原名保留；专名类别说明'),
'smlie':('Smlie（专名，原名保留）','原标签拼写保留；无可靠中文对应'),
'gavarion_trigger':('Gavarion Trigger（专名/作品标签）','保留原名；无可靠中文对应'),
'archouchou':('Archouchou（专名，原名保留）','无可靠中文对应，保留原名'),
'phessian':('Phessian（专名，原名保留）','无可靠中文对应，保留原名'),
'olofboost':('Olofboost（专名，原名保留）','无可靠中文对应，保留原名'),
'rwb':('RWB（缩写标签）','缩写原样保留；无可靠消歧信息'),
})
works={}
for r in csv.DictReader((root/'.cache/zh/ame-copyright.csv').open(encoding='utf-8-sig')):
    if r.get('tag') and r.get('zh'): works[r['tag']]=r['zh']
out=[]
for g in gaps:
 if g['site']!='danbooru' and not g['name'].endswith('_(cosplay)') and not g['name'].endswith('_(style)'): continue
 n=g['name']; trans=None; source=None; kind='说明'
 if n in manual:
  trans,source=manual[n]
 elif n.endswith('_(cosplay)'):
  base=n[:-10]
  if base in chars:
   trans=f'{chars[base]}（角色扮装）'; source=f'本地 type=4 角色译名精确匹配基名 {base}；标签后缀 _(cosplay) 表示角色扮装'
 elif n.endswith('_(style)'):
  base=n[:-8]
  if base in artists:
   trans=f'{artists[base]}（画风）'; source=f'本地 ame-artist 画师名 {base} 精确匹配，_(style) 表示画风'
  elif base in chars:
   trans=f'{chars[base]}（画风）'; source=f'本地 type=4 名称精确匹配基名 {base}；标签后缀 _(style) 表示画风'
 elif g['site']=='gelbooru' and re.fullmatch(r'.+_\([^()]+\)',n):
  base,qual=n.rsplit('_(',1); qual=qual[:-1]
  if base in chars and qual in works:
   trans=f'{chars[base]}（标签中的限定词指《{works[qual]}》）'; source=f'本地 type=4 角色名 {base} 与 ame-copyright 作品名 {qual} 精确配对；括注作限定作品说明'
  elif base in chars and qual in {'xai','samsung','ado'}:
   trans=f'{chars[base]}（标签限定词：{qual}）'; source=f'本地 type=4 角色名 {base} 精确匹配；括注限定词保留原名'

 if trans:
  out.append(dict(site=g['site'],name=n,type=g['type'],translation=trans,kind=kind,source=source))
p=root/'resources/zh-tail-names.csv'
with p.open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.DictWriter(f,fieldnames=['site','name','type','translation','kind','source']); w.writeheader(); w.writerows(out)
print(f'wrote {len(out)} rows; dan={sum(x["site"]=="danbooru" for x in out)}, gel={sum(x["site"]=="gelbooru" for x in out)}')
