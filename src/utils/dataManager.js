// 本地存储键名
const STORAGE_KEYS = {
  PARTICIPANTS: 'lottery_participants',
  WINNERS: 'lottery_winners',
  SETTINGS: 'lottery_settings',
  BACKGROUND_MUSIC: 'lottery_music',
  DESIGNATED_LIST: 'lottery_designated_list',
  BLACKLIST: 'lottery_blacklist'
};

/**
 * 保存基础设置
 */
export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    return true;
  } catch (e) {
    console.error('保存设置失败:', e);
    return false;
  }
}

/**
 * 加载基础设置
 */
export function loadSettings() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('加载设置失败:', e);
    return null;
  }
}

/**
 * 获取默认设置
 */
export function getDefaultSettings() {
  return {
    // 基础信息
    mainTitle: '2026年积极公司',
    subTitle: '元旦抽奖',
    firstPrize: 'iPhone 17 Pro Max',

    // 奖品设置
    prizes: [
      { id: 1, name: '特等奖', count: 1, drawCount: 1, image: null },
      { id: 2, name: '一等奖', count: 3, drawCount: 1, image: null },
      { id: 3, name: '二等奖', count: 10, drawCount: 1, image: null },
      { id: 4, name: '三等奖', count: 20, drawCount: 5, image: null },
      { id: 5, name: '参与奖', count: 50, drawCount: 10, image: null }
    ],

    // 当前选中的奖项
    currentPrizeId: 5,

    // 是否允许重复中奖
    allowRepeatWinners: false,

    // 开始抽奖时自动播放音乐
    autoPlayMusic: true,

    // 抽奖模式: 'manual' | 'auto'
    drawMode: 'auto',

    // 自动模式倒计时时长（秒）
    countdownDuration: 5
  };
}

/**
 * 3D 墙渲染常量 - 必须与 CylinderLayout.jsx 中的值匹配
 * CylinderLayout: 6 行 x 30 列 = 180 个基础卡片
 * 每行添加 20 个克隆（10 头 + 10 尾）= 50 个 DOM
 * 总 DOM 数量 = 6 x 50 = 300
 */
const BASE_CARD_COUNT = 180; // 6 行 x 30 列
const TARGET_VISUAL_COUNT = 180; // 固定显示 180 个基础卡片

/**
 * 视觉恒定算法：无论用户导入多少人，永远返回固定数量的卡片
 *
 * 数据与视觉分离：
 * - 输入：users（可能 50 人，也可能 10000 人）
 * - 输出：永远固定 180 个卡片对象
 *
 * 这确保了 3D 墙的 DOM 数量永远恒定，不会因数据量变化而塌陷
 */
export function createVisualBuffer(users) {
  if (!users || users.length === 0) {
    return [];
  }

  const result = [];

  // 如果用户数量不足，循环复制直到填满 180 个
  if (users.length < TARGET_VISUAL_COUNT) {
    let index = 0;
    while (result.length < TARGET_VISUAL_COUNT) {
      for (const u of users) {
        if (result.length >= TARGET_VISUAL_COUNT) break;
        result.push({
          ...u,
          id: `${u.id}_visual_${index}`,
          originalId: u.id
        });
        index++;
      }
    }
    return result;
  }

  // 如果用户数量超过 180，只截取前 180 个用于显示
  // 注意：完整的用户数据保存在 localStorage 中，抽奖时使用完整数据
  return users.slice(0, TARGET_VISUAL_COUNT);
}

/**
 * 从显示名单中获取原始ID
 */
export function getOriginalId(displayId) {
  if (typeof displayId === 'string') {
    // 处理 _visual_ 后缀（新格式）
    if (displayId.includes('_visual_')) {
      return displayId.split('_visual_')[0];
    }
    // 处理 _copy_ 后缀（旧格式，兼容）
    if (displayId.includes('_copy_')) {
      return displayId.split('_copy_')[0];
    }
  }
  return displayId;
}

/**
 * 保存参与者名单到本地存储
 */
export function saveParticipants(participants) {
  try {
    localStorage.setItem(STORAGE_KEYS.PARTICIPANTS, JSON.stringify(participants));
    return true;
  } catch (e) {
    console.error('保存名单失败:', e);
    return false;
  }
}

/**
 * 从本地存储加载参与者名单
 */
export function loadParticipants() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PARTICIPANTS);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('加载名单失败:', e);
    return null;
  }
}

/**
 * 保存中奖记录
 */
export function saveWinners(winners) {
  try {
    localStorage.setItem(STORAGE_KEYS.WINNERS, JSON.stringify(winners));
    return true;
  } catch (e) {
    console.error('保存中奖记录失败:', e);
    return false;
  }
}

/**
 * 加载中奖记录
 */
export function loadWinners() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.WINNERS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('加载中奖记录失败:', e);
    return [];
  }
}

/**
 * 添加中奖记录
 */
export function addWinner(winner) {
  const winners = loadWinners();
  const winnerRecord = {
    ...winner,
    winTime: new Date().toISOString(),
    winDate: new Date().toLocaleDateString('zh-CN'),
    winTimeStr: new Date().toLocaleTimeString('zh-CN')
  };
  winners.push(winnerRecord);
  saveWinners(winners);
  return winnerRecord;
}

/**
 * 清除中奖记录
 */
export function clearWinners() {
  localStorage.removeItem(STORAGE_KEYS.WINNERS);
}

/**
 * 判断是否为表头行
 */
function isHeaderRow(row) {
  if (!row || row.length === 0) return false;
  const firstCell = String(row[0]).toLowerCase().trim();
  // 检查是否包含常见的表头关键词
  const headerKeywords = ['姓名', 'name', '名', '序号', '编号', 'id', 'no', '号码'];
  return headerKeywords.some(keyword => firstCell.includes(keyword));
}

/**
 * 智能查找姓名和部门列索引
 */
function findColumnIndices(row) {
  let nameIndex = 0;
  let deptIndex = 1;

  row.forEach((cell, index) => {
    const cellStr = String(cell).toLowerCase().trim();
    if (cellStr.includes('名') || cellStr.includes('name')) {
      nameIndex = index;
    } else if (cellStr.includes('部') || cellStr.includes('dept') || cellStr.includes('department')) {
      deptIndex = index;
    }
  });

  return { nameIndex, deptIndex };
}

/**
 * 解析粘贴的文本数据（支持Excel制表符、CSV）
 */
export function parsePastedText(text) {
  if (!text || !text.trim()) {
    return [];
  }

  const lines = text.trim().split('\n');

  // 检测分隔符
  const firstLine = lines[0];
  const separator = firstLine.includes('\t') ? '\t' : ',';

  // 解析所有行
  const rows = lines.map(line => {
    line = line.trim();
    if (!line) return null;
    let parts = line.split(separator);
    return parts.map(p => p.trim()).filter(p => p);
  }).filter(row => row && row.length > 0);

  if (rows.length === 0) return [];

  // 检查是否需要跳过表头
  let startIndex = 0;
  let { nameIndex, deptIndex } = findColumnIndices(rows[0]);

  // 如果第一行看起来像表头，跳过它并重新查找列
  if (isHeaderRow(rows[0])) {
    startIndex = 1;
    if (rows.length > 1) {
      const indices = findColumnIndices(rows[0]);
      nameIndex = indices.nameIndex;
      deptIndex = indices.deptIndex;
    }
  }

  const result = [];
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0) continue;

    const name = row[nameIndex] || row[0];
    const department = row[deptIndex] || row[1] || '未分组';

    // 跳过无效姓名
    if (!name || name.length < 2 || /^[0-9]+$/.test(name)) {
      continue;
    }

    result.push({
      id: `import_${Date.now()}_${i}`,
      name: String(name).trim(),
      department: String(department).trim(),
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(String(name).trim())}&backgroundColor=b6e3f4`
    });
  }

  return result;
}

/**
 * 解析 Excel 文件
 */
export async function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // 获取第一个工作表
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // 转换为JSON数组
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!jsonData || jsonData.length === 0) {
          resolve([]);
          return;
        }

        // 检查是否需要跳过表头，并查找列索引
        let startIndex = 0;
        let { nameIndex, deptIndex } = findColumnIndices(jsonData[0]);

        // 如果第一行是表头，跳过它
        if (isHeaderRow(jsonData[0])) {
          startIndex = 1;
        }

        const result = [];
        for (let i = startIndex; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          const name = row[nameIndex] || row[0];
          const department = row[deptIndex] || row[1] || '未分组';

          // 跳过无效姓名（空值、纯数字、太短）
          if (!name || String(name).trim().length < 2 || /^[0-9]+$/.test(String(name).trim())) {
            continue;
          }

          const nameStr = String(name).trim();
          result.push({
            id: `excel_${Date.now()}_${i}`,
            name: nameStr,
            department: String(department).trim(),
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(nameStr)}&backgroundColor=b6e3f4`
          });
        }

        resolve(result);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 解析 CSV 文件
 */
export async function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const result = parsePastedText(text);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

/**
 * 清除所有本地数据
 */
export function clearAllData() {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
}

// ==================== 指定名单（内定）功能 ====================

/**
 * 保存指定名单
 */
export function saveDesignatedList(designatedList) {
  try {
    localStorage.setItem(STORAGE_KEYS.DESIGNATED_LIST, JSON.stringify(designatedList));
    return true;
  } catch (e) {
    console.error('保存指定名单失败:', e);
    return false;
  }
}

/**
 * 加载指定名单
 */
export function loadDesignatedList() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.DESIGNATED_LIST);
    return data ? JSON.parse(data) : { designatedList: {} };
  } catch (e) {
    console.error('加载指定名单失败:', e);
    return { designatedList: {} };
  }
}

/**
 * 添加指定名单人员
 * @param {number} prizeId - 奖项ID
 * @param {object} person - 人员对象 {id, name, department}
 * @param {array} blacklist - 当前黑名单（用于互斥检查）
 * @param {object} allDesignatedList - 所有指定名单（用于检查是否已在其他奖项中）
 */
export function addDesignatedPerson(prizeId, person, blacklist = [], allDesignatedList = null) {
  const designatedList = allDesignatedList || loadDesignatedList();

  // 检查是否在黑名单中
  if (blacklist.some(p => p.id === person.id)) {
    throw new Error('该人员已在黑名单中，无法添加到指定名单');
  }

  // 检查是否已在该奖项的指定名单中
  if (!designatedList.designatedList[prizeId]) {
    designatedList.designatedList[prizeId] = [];
  }

  if (designatedList.designatedList[prizeId].some(p => p.id === person.id)) {
    throw new Error('该人员已在该奖项的指定名单中');
  }

  // 检查是否在其他奖项的指定名单中
  for (const [otherPrizeId, persons] of Object.entries(designatedList.designatedList)) {
    if (Number(otherPrizeId) !== prizeId && persons.some(p => p.id === person.id)) {
      throw new Error(`该人员已在其他奖项的指定名单中`);
    }
  }

  designatedList.designatedList[prizeId].push({
    id: person.id,
    name: person.name,
    department: person.department,
    avatar: person.avatar
  });

  saveDesignatedList(designatedList);
  return designatedList;
}

/**
 * 移除指定名单人员
 */
export function removeDesignatedPerson(prizeId, personId) {
  const designatedList = loadDesignatedList();

  if (designatedList.designatedList[prizeId]) {
    designatedList.designatedList[prizeId] = designatedList.designatedList[prizeId]
      .filter(p => p.id !== personId);

    // 如果该奖项没有内定人员了，删除该key
    if (designatedList.designatedList[prizeId].length === 0) {
      delete designatedList.designatedList[prizeId];
    }
  }

  saveDesignatedList(designatedList);
  return designatedList;
}

/**
 * 获取某奖项的指定名单
 */
export function getDesignatedListForPrize(prizeId) {
  const designatedList = loadDesignatedList();
  return designatedList.designatedList[prizeId] || [];
}

// ==================== 黑名单功能 ====================

/**
 * 保存黑名单
 */
export function saveBlacklist(blacklist) {
  try {
    localStorage.setItem(STORAGE_KEYS.BLACKLIST, JSON.stringify(blacklist));
    return true;
  } catch (e) {
    console.error('保存黑名单失败:', e);
    return false;
  }
}

/**
 * 加载黑名单
 */
export function loadBlacklist() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.BLACKLIST);
    return data ? JSON.parse(data) : { blacklist: [] };
  } catch (e) {
    console.error('加载黑名单失败:', e);
    return { blacklist: [] };
  }
}

/**
 * 添加黑名单人员
 * @param {object} person - 人员对象
 * @param {object} designatedList - 当前指定名单（用于互斥检查）
 */
export function addBlacklistPerson(person, designatedList = null) {
  const blacklistData = loadBlacklist();
  const desigList = designatedList || loadDesignatedList();

  // 检查是否在黑名单中
  if (blacklistData.blacklist.some(p => p.id === person.id)) {
    throw new Error('该人员已在黑名单中');
  }

  // 检查是否在指定名单中
  for (const [prizeId, persons] of Object.entries(desigList.designatedList || {})) {
    if (persons.some(p => p.id === person.id)) {
      throw new Error('该人员已在指定名单中，无法添加到黑名单');
    }
  }

  blacklistData.blacklist.push({
    id: person.id,
    name: person.name,
    department: person.department,
    avatar: person.avatar
  });

  saveBlacklist(blacklistData);
  return blacklistData;
}

/**
 * 移除黑名单人员
 */
export function removeBlacklistPerson(personId) {
  const blacklistData = loadBlacklist();
  blacklistData.blacklist = blacklistData.blacklist.filter(p => p.id !== personId);
  saveBlacklist(blacklistData);
  return blacklistData;
}

/**
 * 检查人员是否在黑名单中
 */
export function isPersonBlacklisted(personId) {
  const blacklistData = loadBlacklist();
  return blacklistData.blacklist.some(p => p.id === personId);
}
