import { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import Header from './components/Header';
import CylinderLayout from './components/CylinderLayout';
import Toast from './components/Toast';
import { toastManager } from './components/Toast';
import { mockPrizes } from './data/mockData';
import confetti from 'canvas-confetti';
import {
  createVisualBuffer,
  saveParticipants,
  loadParticipants,
  loadWinners,
  addWinner as saveWinner,
  parsePastedText,
  parseExcelFile,
  parseCSVFile,
  saveSettings,
  loadSettings,
  getDefaultSettings,
  loadDesignatedList,
  addDesignatedPerson,
  removeDesignatedPerson,
  getDesignatedListForPrize,
  loadBlacklist,
  addBlacklistPerson,
  removeBlacklistPerson
} from './utils/dataManager';
import { audioManager } from './utils/audioManager';
import { exportWinnersToExcel } from './utils/exportManager';

function App() {
  // 基础数据和设置
  // 数据与视觉分离架构：
  // - allParticipants: 完整的导入数据（抽奖池），可能是 50 人或 10000 人
  // - displayPrizes: 固定 180 个卡片，用于 3D 墙显示
  const [allParticipants, setAllParticipants] = useState(mockPrizes);
  const [displayPrizes, setDisplayPrizes] = useState(() => createVisualBuffer(mockPrizes));
  const [settings, setSettings] = useState(() => {
    const saved = loadSettings();
    return saved || getDefaultSettings();
  });

  // 状态
  const [isRolling, setIsRolling] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState(null);
  const [winnersThisDraw, setWinnersThisDraw] = useState([]); // 本轮中奖名单
  const [winnerIds, setWinnerIds] = useState(new Set()); // 所有中奖ID集合

  // 设置面板状态
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [musicFile, setMusicFile] = useState(null);
  const [musicVolume, setMusicVolume] = useState(0.5);
  const [pastedText, setPastedText] = useState('');
  const [importPreview, setImportPreview] = useState([]);
  const [winners, setWinners] = useState([]);

  // 个性化设置状态
  const [designatedList, setDesignatedList] = useState({ designatedList: {} });
  const [blacklist, setBlacklist] = useState([]);

  // 指定名单表单状态
  const [designatedPrizeId, setDesignatedPrizeId] = useState('');
  const [designatedSearchQuery, setDesignatedSearchQuery] = useState('');
  const [designatedSelectedPerson, setDesignatedSelectedPerson] = useState(null);
  const [designatedDropdownOpen, setDesignatedDropdownOpen] = useState(false);

  // 黑名单表单状态
  const [blacklistSearchQuery, setBlacklistSearchQuery] = useState('');
  const [blacklistSelectedPerson, setBlacklistSelectedPerson] = useState(null);
  const [blacklistDropdownOpen, setBlacklistDropdownOpen] = useState(false);

  // 当前选中的奖项ID（默认选最低级别的奖项）
  const [selectedPrizeId, setSelectedPrizeId] = useState(() => {
    const saved = loadSettings();
    const prizeList = saved?.prizes || getDefaultSettings().prizes;
    // 默认选最大ID（最低级别）
    return prizeList.length > 0 ? prizeList[prizeList.length - 1].id : prizeList[0]?.id || 1;
  });

  // 表单状态
  const [mainTitleInput, setMainTitleInput] = useState(settings.mainTitle);
  const [subTitleInput, setSubTitleInput] = useState(settings.subTitle);
  const [allowRepeatWinners, setAllowRepeatWinners] = useState(settings.allowRepeatWinners ?? false);
  const [autoPlayMusic, setAutoPlayMusic] = useState(settings.autoPlayMusic ?? true);
  const [drawMode, setDrawMode] = useState(settings.drawMode ?? 'auto');
  const [countdownDuration, setCountdownDuration] = useState(settings.countdownDuration ?? 5);
  const [prizesConfig, setPrizesConfig] = useState(settings.prizes);

  // 使用 useMemo 稳定引用，避免 useCallback 循环依赖
  const stableDesignatedList = useMemo(() => designatedList, [designatedList.designatedList]);
  const stableBlacklist = useMemo(() => blacklist, [blacklist.length]);

  // 倒计时状态
  const [countdown, setCountdown] = useState(0);
  const countdownTimerRef = useRef(null);

  // 显示中奖结果状态（手动模式需要手动关闭）
  const [showWinnersResult, setShowWinnersResult] = useState(false);

  // 存储本轮抽奖数据的 refs
  const selectedWinnersRef = useRef(null);
  const currentPrizeRef = useRef(null);
  const isRollingRef = useRef(false); // 使用 ref 跟踪 isRolling �状态
  const startLotteryRef = useRef(null);
  const stopLotteryRef = useRef(null);

  // 使用 ref 存储状态值，避免键盘事件监听器的依赖问题
  const showSettingsRef = useRef(showSettings);
  const showWinnersResultRef = useRef(showWinnersResult);
  const prizesConfigRef = useRef(prizesConfig);
  const selectedPrizeIdRef = useRef(selectedPrizeId);

  const resetTimerRef = useRef(null);

  // 同步状态到 ref
  useEffect(() => {
    isRollingRef.current = isRolling;
    showSettingsRef.current = showSettings;
    showWinnersResultRef.current = showWinnersResult;
    prizesConfigRef.current = prizesConfig;
    selectedPrizeIdRef.current = selectedPrizeId;
  }, [isRolling, showSettings, showWinnersResult, prizesConfig, selectedPrizeId]);

  // 加载保存的数据
  useEffect(() => {
    const savedWinners = loadWinners();
    setWinners(savedWinners);

    const savedParticipants = loadParticipants();
    if (savedParticipants && savedParticipants.length > 0) {
      // 有导入数据：3D墙和抽奖池都使用真实数据（通过复制填满180个）
      setAllParticipants(savedParticipants);
      const buffer = createVisualBuffer(savedParticipants);
      setDisplayPrizes(buffer);
    }

    // 加载个性化设置
    const savedDesignatedList = loadDesignatedList();
    setDesignatedList(savedDesignatedList);

    const savedBlacklist = loadBlacklist();
    setBlacklist(savedBlacklist.blacklist);
  }, []);

  // 音乐管理器监听
  useEffect(() => {
    const unsubscribe = audioManager.addListener((event, data) => {
      if (event === 'volumeChange') {
        setMusicVolume(data.volume);
      }
    });
    return unsubscribe;
  }, []);

  // 组件卸载时清除
  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
      audioManager.destroy();
    };
  }, []);

  // 关闭中奖结果页面
  const handleCloseWinnersResult = useCallback(() => {
    setShowWinnersResult(false);
    setWinnersThisDraw([]);
    setWinnerIds(new Set());
    setWinner(null);
  }, []);

  // 键盘事件监听（仅手动模式）- 使用 ref 避免依赖循环
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 如果设置面板打开，不处理键盘事件
      if (showSettingsRef.current) return;

      // 空格键或回车键
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();

        // 如果正在显示中奖结果，关闭结果返回抽奖页面
        if (showWinnersResultRef.current) {
          handleCloseWinnersResult();
          return;
        }

        // 如果正在抽奖，停止抽奖
        if (isRollingRef.current) {
          stopLotteryRef.current?.();
        } else {
          // 否则开始抽奖
          startLotteryRef.current?.();
        }
        return;
      }

      // 左右键切换奖项（仅在未抽奖时）
      if (!isRollingRef.current && !showWinnersResultRef.current) {
        const prizes = prizesConfigRef.current;
        const currentId = selectedPrizeIdRef.current;
        const currentIndex = prizes.findIndex(p => p.id === currentId);
        if (e.code === 'ArrowLeft') {
          e.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : prizes.length - 1;
          setSelectedPrizeId(prizes[prevIndex].id);
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          const nextIndex = currentIndex < prizes.length - 1 ? currentIndex + 1 : 0;
          setSelectedPrizeId(prizes[nextIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // 空依赖数组，所有状态通过 ref 访问

  // 触发撒花特效
  const triggerConfetti = useCallback(() => {
    const duration = 4000;
    const end = Date.now() + duration;
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];

    const leftSide = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: colors
      });
    };

    const rightSide = () => {
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: colors
      });
    };

    const frame = () => {
      leftSide();
      rightSide();
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    confetti({
      particleCount: 100,
      spread: 100,
      origin: { x: 0.5, y: 0.5 },
      colors: colors,
      scalar: 1.2
    });

    frame();
  }, []);

  // 停止抽奖
  const stopLottery = useCallback(() => {
    // 使用 ref 检查，确保能获取到最新值
    if (!isRollingRef.current) return;

    const selected = selectedWinnersRef.current;
    const currentPrize = currentPrizeRef.current;

    if (!selected || !currentPrize) return;

    // 清除倒计时
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(0);

    setIsSpinning(false);
    setTimeout(() => {
      setIsRolling(false);
      setWinnersThisDraw(selected);
      setWinnerIds(new Set(selected.map(w => w.id)));

      // 保存所有中奖记录
      const newWinnerRecords = selected.map(w => saveWinner({
        ...w,
        prizeId: selectedPrizeId,
        prizeName: currentPrize.name
      }));
      setWinners(prev => [...prev, ...newWinnerRecords]);

      triggerConfetti();

      // 手动模式：显示结果页面，等待用户手动关闭
      // 自动模式：5秒后自动关闭
      if (drawMode === 'manual') {
        setShowWinnersResult(true);
      } else {
        resetTimerRef.current = setTimeout(() => {
          setWinnersThisDraw([]);
          setWinnerIds(new Set());
          resetTimerRef.current = null;
        }, 5000);
      }
    }, 800);
  }, [selectedPrizeId, triggerConfetti, drawMode]);

  // ==================== 个性化功能辅助函数 ====================

  // 获取可用于指定名单的人员（排除已在黑名单和指定名单中的人员）
  const getAvailableParticipantsForDesignated = () => {
    if (!designatedSearchQuery) return [];

    const query = designatedSearchQuery.toLowerCase();
    const blacklistIds = new Set(blacklist.map(p => p.id));

    // 收集所有已在指定名单中的人员ID
    const designatedIds = new Set();
    Object.values(designatedList.designatedList).forEach(persons => {
      persons.forEach(p => designatedIds.add(p.id));
    });

    return allParticipants.filter(p => {
      // 排除黑名单
      if (blacklistIds.has(p.id)) return false;
      // 排除已在指定名单中的
      if (designatedIds.has(p.id)) return false;
      // 搜索匹配
      const matchName = p.name.toLowerCase().includes(query);
      const matchDept = p.department.toLowerCase().includes(query);
      return matchName || matchDept;
    }).slice(0, 10); // 限制显示10条
  };

  // 获取可用于黑名单的人员（排除已在黑名单和指定名单中的人员）
  const getAvailableParticipantsForBlacklist = () => {
    if (!blacklistSearchQuery) return [];

    const query = blacklistSearchQuery.toLowerCase();
    const blacklistIds = new Set(blacklist.map(p => p.id));

    // 收集所有已在指定名单中的人员ID
    const designatedIds = new Set();
    Object.values(designatedList.designatedList).forEach(persons => {
      persons.forEach(p => designatedIds.add(p.id));
    });

    return allParticipants.filter(p => {
      // 排除已在黑名单中的
      if (blacklistIds.has(p.id)) return false;
      // 排除已在指定名单中的
      if (designatedIds.has(p.id)) return false;
      // 搜索匹配
      const matchName = p.name.toLowerCase().includes(query);
      const matchDept = p.department.toLowerCase().includes(query);
      return matchName || matchDept;
    }).slice(0, 10);
  };

  // 添加指定名单人员
  const handleAddDesignatedPerson = () => {
    if (!designatedPrizeId || !designatedSelectedPerson) return;

    try {
      const updated = addDesignatedPerson(
        Number(designatedPrizeId),
        designatedSelectedPerson,
        blacklist,
        designatedList
      );
      setDesignatedList(updated);

      // 重置表单
      setDesignatedSelectedPerson(null);
      setDesignatedSearchQuery('');

      toastManager.success(`已将 ${designatedSelectedPerson.name} 添加到指定名单`);
    } catch (err) {
      toastManager.error(err.message);
    }
  };

  // 移除指定名单人员
  const handleRemoveDesignatedPerson = (prizeId, personId) => {
    const updated = removeDesignatedPerson(prizeId, personId);
    setDesignatedList(updated);
    toastManager.delete('已从指定名单移除');
  };

  // 添加黑名单人员
  const handleAddBlacklistPerson = () => {
    if (!blacklistSelectedPerson) return;

    try {
      const updated = addBlacklistPerson(blacklistSelectedPerson, designatedList);
      setBlacklist(updated.blacklist);

      // 重置表单
      setBlacklistSelectedPerson(null);
      setBlacklistSearchQuery('');

      toastManager.success(`已将 ${blacklistSelectedPerson.name} 添加到黑名单`);
    } catch (err) {
      toastManager.error(err.message);
    }
  };

  // 移除黑名单人员
  const handleRemoveBlacklistPerson = (personId) => {
    const updated = removeBlacklistPerson(personId);
    setBlacklist(updated.blacklist);
    toastManager.delete('已从黑名单移除');
  };

  // 开始抽奖
  const startLottery = useCallback(() => {
    if (isRolling) return;

    // 获取当前选中的奖项
    const currentPrize = prizesConfig.find(p => p.id === selectedPrizeId);
    if (!currentPrize) return;

    // 计算该奖项已中奖人数
    const prizeWinnerCount = winners.filter(w => w.prizeId === selectedPrizeId).length;
    if (prizeWinnerCount >= currentPrize.count) {
      toastManager.error(`${currentPrize.name}已抽取完毕，请选择其他奖项`);
      return;
    }

    // 确定本次抽取人数（不超过剩余名额）
    const drawCount = Math.min(currentPrize.drawCount || 1, currentPrize.count - prizeWinnerCount);

    // ========== 获取指定名单和黑名单 ==========
    const designatedPersons = getDesignatedListForPrize(selectedPrizeId);
    const blacklistIds = new Set(stableBlacklist.map(p => p.id));

    // 检查指定名单中是否还有人未中奖
    const remainingDesignated = designatedPersons.filter(p => {
      // 检查是否已中该奖项
      const alreadyWon = winners.some(w =>
        w.id === p.id && w.prizeId === selectedPrizeId
      );
      return !alreadyWon;
    });

    let selected = [];

    // 如果有指定名单剩余人员，优先抽取指定名单
    if (remainingDesignated.length > 0) {
      // 从指定名单中抽取（不超过drawCount和剩余指定人数）
      const selectFromDesignated = Math.min(drawCount, remainingDesignated.length);
      const designatedPool = [...remainingDesignated];
      for (let i = 0; i < selectFromDesignated; i++) {
        const randomIndex = Math.floor(Math.random() * designatedPool.length);
        selected.push(designatedPool[randomIndex]);
        designatedPool.splice(randomIndex, 1);
      }

      // 如果指定名单人数不足，从普通池中补充
      if (selected.length < drawCount) {
        const remainingCount = drawCount - selected.length;
        const selectedIds = new Set(selected.map(p => p.id));

        // 构建普通抽奖池
        let availablePool = allParticipants.filter(p => {
          // 排除黑名单
          if (blacklistIds.has(p.id)) return false;
          // 排除已选中的指定名单人员
          if (selectedIds.has(p.id)) return false;
          // 排除指定名单中未中奖的人（留给下次）
          if (remainingDesignated.some(d => d.id === p.id)) return false;
          // 不允许重复中奖时，排除已中奖者
          if (!allowRepeatWinners && winners.length > 0) {
            const existingWinnerIds = new Set(winners.map(w => w.id));
            return !existingWinnerIds.has(p.id);
          }
          return true;
        });

        if (availablePool.length < remainingCount) {
          toastManager.error(`可用人数不足，需要 ${remainingCount} 人，可用 ${availablePool.length} 人`);
          return;
        }

        const poolCopy = [...availablePool];
        for (let i = 0; i < remainingCount; i++) {
          const randomIndex = Math.floor(Math.random() * poolCopy.length);
          selected.push(poolCopy[randomIndex]);
          poolCopy.splice(randomIndex, 1);
        }
      }
    } else {
      // 没有指定名单，按原有逻辑抽取
      let availablePool = allParticipants;

      // 排除黑名单
      availablePool = availablePool.filter(p => !blacklistIds.has(p.id));

      // 不允许重复中奖时，排除已中奖者
      if (!allowRepeatWinners && winners.length > 0) {
        const existingWinnerIds = new Set(winners.map(w => w.id));
        availablePool = availablePool.filter(p => !existingWinnerIds.has(p.id));
      }

      if (availablePool.length < drawCount) {
        toastManager.error(`可用人数不足，需要 ${drawCount} 人，可用 ${availablePool.length} 人`);
        return;
      }

      const poolCopy = [...availablePool];
      for (let i = 0; i < drawCount; i++) {
        const randomIndex = Math.floor(Math.random() * poolCopy.length);
        selected.push(poolCopy[randomIndex]);
        poolCopy.splice(randomIndex, 1);
      }
    }
    // ========== 结束：指定名单和黑名单逻辑 ==========

    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }

    // 清除倒计时
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    setIsRolling(true);
    setIsSpinning(true);
    setWinner(null);
    setWinnersThisDraw([]);
    setWinnerIds(new Set());

    // 自动播放音乐（如果开启且已上传音乐）
    if (autoPlayMusic && audioManager.hasMusic()) {
      audioManager.play(true);
    }

    // 保存选中的中奖者到 refs
    selectedWinnersRef.current = selected;
    currentPrizeRef.current = currentPrize;

    // 自动模式：启动倒计时
    if (drawMode === 'auto') {
      setCountdown(countdownDuration);

      let secondsLeft = countdownDuration;
      countdownTimerRef.current = setInterval(() => {
        secondsLeft--;
        setCountdown(secondsLeft);

        if (secondsLeft <= 0) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
          // 调用停止抽奖函数
          stopLottery();
        }
      }, 1000);
    }
    // 手动模式：不启动倒计时，等待用户点击停止
  }, [isRolling, allParticipants, selectedPrizeId, prizesConfig, winners, allowRepeatWinners, autoPlayMusic, drawMode, countdownDuration, stopLottery, stableDesignatedList, stableBlacklist]);

  // 同步函数到 ref（使用 useEffect，但依赖稳定的函数引用）
  useEffect(() => {
    startLotteryRef.current = startLottery;
    stopLotteryRef.current = stopLottery;
  }, [startLottery, stopLottery]);

  // 保存基础设置
  const handleSaveBasicSettings = () => {
    const newSettings = {
      ...settings,
      mainTitle: mainTitleInput,
      subTitle: subTitleInput,
      allowRepeatWinners: allowRepeatWinners,
      autoPlayMusic: autoPlayMusic,
      drawMode: drawMode,
      countdownDuration: countdownDuration,
      prizes: prizesConfig
    };
    setSettings(newSettings);
    saveSettings(newSettings);
    toastManager.success('设置已保存');
  };

  // 音乐上传
  const handleMusicUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await audioManager.loadMusic(file);
      setMusicFile(file);
      toastManager.success('音乐上传成功');
    } catch (err) {
      toastManager.error('音乐上传失败');
    }
  };

  const handleClearMusic = () => {
    audioManager.clearMusic();
    setMusicFile(null);
  };

  // 文件导入
  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let result;
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        result = await parseExcelFile(file);
      } else if (file.name.endsWith('.csv')) {
        result = await parseCSVFile(file);
      } else {
        toastManager.error('不支持的文件格式，请上传 Excel (.xlsx, .xls) 或 CSV 文件');
        return;
      }

      if (result.length === 0) {
        toastManager.error('文件中没有识别到有效数据');
        return;
      }

      // 导入数据：3D墙显示真实数据（通过复制填满180个）
      saveParticipants(result);
      setAllParticipants(result);
      const buffer = createVisualBuffer(result);
      setDisplayPrizes(buffer);
      toastManager.success(`成功导入 ${result.length} 人`);
      setPastedText('');
      setImportPreview([]);
    } catch (err) {
      toastManager.error('文件解析失败：' + err.message);
    }
  };

  // 文本导入
  const handleTextImport = () => {
    const parsed = parsePastedText(pastedText);
    if (parsed.length === 0) {
      toastManager.error('没有识别到有效数据');
      return;
    }
    setImportPreview(parsed.slice(0, 10));
  };

  const handleConfirmImport = () => {
    if (importPreview.length === 0) return;

    const parsed = parsePastedText(pastedText);

    // 导入数据：3D墙显示真实数据（通过复制填满180个）
    saveParticipants(parsed);
    setAllParticipants(parsed);
    const buffer = createVisualBuffer(parsed);
    setDisplayPrizes(buffer);
    setPastedText('');
    setImportPreview([]);
    toastManager.success(`成功导入 ${parsed.length} 人`);
  };

  // 导出中奖名单
  const handleExportWinners = () => {
    if (winners.length === 0) {
      toastManager.error('暂无中奖记录');
      return;
    }
    exportWinnersToExcel(winners);
  };

  const handleClearWinners = () => {
    setWinners([]);
    localStorage.removeItem('lottery_winners');
    toastManager.success('已清除中奖记录');
  };

  // 根据奖项名称获取标签样式
  const getPrizeBadgeStyles = (prizeName) => {
    const name = prizeName || '';
    const styles = {
      '特等奖': 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/30',
      '一等奖': 'bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-400 border-red-500/30',
      '二等奖': 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-400 border-yellow-500/30',
      '三等奖': 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-400 border-blue-500/30',
      '参与奖': 'bg-gradient-to-r from-gray-500/20 to-slate-500/20 text-gray-400 border-gray-500/30',
    };

    for (const [key, value] of Object.entries(styles)) {
      if (name.includes(key)) {
        return value;
      }
    }
    // 默认样式
    return 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border-green-500/30';
  };

  // 奖品图片上传
  const handlePrizeImageUpload = (prizeId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target.result;
      const updatedPrizes = prizesConfig.map(p =>
        p.id === prizeId ? { ...p, image: imageUrl } : p
      );
      setPrizesConfig(updatedPrizes);
    };
    reader.readAsDataURL(file);
  };

  // 更新奖项配置
  const updatePrizeConfig = (prizeId, field, value) => {
    const updatedPrizes = prizesConfig.map(p =>
      p.id === prizeId ? { ...p, [field]: value } : p
    );
    setPrizesConfig(updatedPrizes);
  };

  // 增加奖项
  const addPrize = () => {
    const newId = Math.max(...prizesConfig.map(p => p.id), 0) + 1;
    const newPrize = {
      id: newId,
      name: `新奖项`,
      count: 1,
      drawCount: 1,
      image: null
    };
    setPrizesConfig([...prizesConfig, newPrize]);
  };

  // 删除奖项
  const deletePrize = (prizeId) => {
    if (prizesConfig.length <= 1) {
      toastManager.error('至少需要保留一个奖项');
      return;
    }
    // 检查是否有该奖项的中奖记录
    const hasWinners = winners.some(w => w.prizeId === prizeId);
    if (hasWinners) {
      toastManager.error('该奖项已有中奖记录，无法删除');
      return;
    }

    const prize = prizesConfig.find(p => p.id === prizeId);
    const updatedPrizes = prizesConfig.filter(p => p.id !== prizeId);
    setPrizesConfig(updatedPrizes);

    // 如果删除的是当前选中的奖项，切换到第一个奖项
    if (selectedPrizeId === prizeId) {
      setSelectedPrizeId(updatedPrizes[0].id);
    }

    toastManager.delete(`已删除奖项: ${prize?.name}`);
  };

  // 音乐切换处理
  const handleToggleMusic = () => {
    if (!audioManager.hasMusic()) {
      toastManager.error('请先在设置中上传背景音乐');
      return;
    }

    if (audioManager.isPlaying) {
      audioManager.pause();
    } else {
      audioManager.play();
    }
  };

  return (
    <div className="w-full h-screen overflow-hidden bg-slate-950">
      <Toast />
      <Header
        mainTitle={settings.mainTitle}
        subTitle={settings.subTitle}
        onOpenSettings={() => setShowSettings(true)}
        onToggleMusic={handleToggleMusic}
        isPlaying={audioManager.isPlaying}
        hasMusic={audioManager.hasMusic()}
      />

      <div className="lottery-viewport">
        <CylinderLayout
          prizes={displayPrizes}
          winnerIds={winnerIds}
          isSpinning={isSpinning}
        />
      </div>

      {/* 控制按钮 */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4">
        {/* 奖项选择器 */}
        <div className="relative">
          <select
            value={selectedPrizeId}
            onChange={(e) => setSelectedPrizeId(Number(e.target.value))}
            disabled={isRolling}
            className={`
              appearance-none px-6 py-3 pr-10 text-xl font-semibold
              bg-slate-900/80 border-2 border-yellow-500/50 rounded-xl
              text-yellow-400 cursor-pointer
              transition-all duration-300
              ${isRolling
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:border-yellow-400 hover:bg-slate-900'
              }
              focus:outline-none focus:ring-2 focus:ring-yellow-500/30
            `}
            style={{
              textShadow: '0 0 10px rgba(250, 204, 21, 0.3)',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23fbbf24'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.75rem center',
              backgroundSize: '1.2rem'
            }}
          >
            {prizesConfig.map((prize) => {
              const winnerCount = winners.filter(w => w.prizeId === prize.id).length;
              const remaining = prize.count - winnerCount;
              return (
                <option
                  key={prize.id}
                  value={prize.id}
                  className="bg-slate-800 text-yellow-400"
                >
                  {prize.name} ({remaining}/{prize.count})
                </option>
              );
            })}
          </select>
        </div>

        {/* 开始抽奖按钮 */}
        <button
          onClick={drawMode === 'manual' && isRolling ? stopLottery : startLottery}
          disabled={isRolling && drawMode === 'auto'}
          className={`
            px-8 py-3 text-3xl font-bold
            transition-all duration-300
            ${isRolling && drawMode === 'auto'
              ? 'text-gray-500 cursor-not-allowed'
              : 'text-yellow-400 hover:text-yellow-300 hover:scale-110'
            }
            ${isRolling && drawMode === 'manual'
              ? 'text-red-400 hover:text-red-300 hover:scale-110 animate-pulse'
              : ''
            }
          `}
          style={{
            textShadow: (isRolling && drawMode === 'auto') ? 'none' : '0 0 20px rgba(250, 204, 21, 0.5), 0 0 40px rgba(250, 204, 21, 0.3)',
            background: 'transparent',
            border: 'none'
          }}
        >
          {drawMode === 'manual' && isRolling ? '点击停止' : (isRolling ? '抽奖中...' : '开始抽奖')}
        </button>
      </div>

      {/* 手动模式：键盘操作提示 */}
      {drawMode === 'manual' && !isRolling && !showWinnersResult && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-4 text-gray-400 text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/60 rounded-lg border border-white/10">
              <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs font-mono">←</kbd>
              <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs font-mono">→</kbd>
              <span>切换奖项</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/60 rounded-lg border border-white/10">
              <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs font-mono">Space</kbd>
              <span>或</span>
              <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs font-mono">Enter</kbd>
              <span>开始抽奖</span>
            </div>
          </div>
        </div>
      )}

      {/* 手动模式：抽奖停止时显示键盘提示 */}
      {drawMode === 'manual' && isRolling && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-2 text-gray-400 text-xs px-3 py-1.5 bg-slate-900/60 rounded-lg border border-white/10">
            <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs font-mono">Space</kbd>
            <span>或</span>
            <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs font-mono">Enter</kbd>
            <span>停止抽奖</span>
          </div>
        </div>
      )}

      {/* 倒计时数字 - 仅自动模式显示 */}
      {isSpinning && drawMode === 'auto' && countdown > 0 && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-none">
          <div
            className="font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-300"
            style={{
              fontSize: 'clamp(120px, 25vw, 200px)',
              lineHeight: '1',
              textShadow: '0 10px 40px rgba(250, 204, 21, 0.8), 0 20px 80px rgba(251, 146, 60, 0.6), 0 0 100px rgba(250, 204, 21, 0.4)',
              animation: countdown > 0 ? 'heartbeat 1s ease-in-out infinite' : 'none',
              mixBlendMode: 'screen',
              opacity: 0.95,
              filter: 'drop-shadow(0 0 30px rgba(250, 204, 21, 0.8))'
            }}
          >
            {countdown}
          </div>
        </div>
      )}

      {/* 手动模式全屏点击层 */}
      {isSpinning && drawMode === 'manual' && (
        <div
          onClick={stopLottery}
          className="fixed inset-0 z-[999] cursor-pointer"
          style={{ background: 'transparent' }}
        />
      )}

      {/* 中奖弹窗 */}
      {winnersThisDraw.length > 0 && !isRolling && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fadeIn p-4"
          onClick={drawMode === 'manual' ? handleCloseWinnersResult : undefined}
        >
          <div className="w-full max-w-6xl mx-auto" onClick={(e) => e.stopPropagation()}>
            {/* 获取当前奖项信息 */}
            {(() => {
              const currentPrize = prizesConfig.find(p => p.id === selectedPrizeId);

              // 根据中奖人数动态调整网格列数
              const getGridCols = () => {
                const count = winnersThisDraw.length;
                if (count === 1) return 'grid-cols-1 max-w-sm mx-auto';
                if (count === 2) return 'grid-cols-2 max-w-lg mx-auto';
                if (count <= 4) return 'grid-cols-2 md:grid-cols-2';
                if (count <= 6) return 'grid-cols-2 md:grid-cols-3';
                if (count <= 9) return 'grid-cols-3 md:grid-cols-4';
                return 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5';
              };

              return (
                <div className="flex flex-col items-center gap-12">
                  {/* 奖品图片 - 规范化圆形 */}
                  {currentPrize?.image && (
                    <div className="flex flex-col items-center gap-6">
                      <img
                        src={currentPrize.image}
                        alt={currentPrize.name}
                        className="w-36 h-36 md:w-44 md:h-44 rounded-full object-cover border-4 border-yellow-400 shadow-lg shadow-yellow-400/30"
                      />
                      {/* 奖项名称 */}
                      <div className="text-yellow-400 text-3xl md:text-4xl font-bold tracking-widest">
                        恭喜获得 {currentPrize?.name || '奖品'}
                      </div>
                    </div>
                  )}

                  {/* 没有图片时只显示标题 */}
                  {!currentPrize?.image && (
                    <div className="text-yellow-400 text-3xl md:text-4xl font-bold tracking-widest">
                      恭喜获得 {currentPrize?.name || '奖品'}
                    </div>
                  )}

                  {/* 中奖令牌网格 */}
                  <div className={`grid ${getGridCols()} gap-6 md:gap-8 w-full`}>
                    {winnersThisDraw.map((w, i) => (
                      <div
                        key={i}
                        className="group relative"
                        style={{
                          animation: `scaleIn 0.5s ease-out ${i * 0.1}s both`
                        }}
                      >
                        {/* 金色外发光效果 */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl blur-lg opacity-60 group-hover:opacity-100 transition-opacity duration-300 animate-pulse" />

                        {/* 主卡片 */}
                        <div className="relative bg-gradient-to-b from-red-800 to-red-900 rounded-2xl p-6 md:p-8 border-2 border-yellow-400 shadow-2xl overflow-hidden">
                          {/* 顶部装饰线 */}
                          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-80" />

                          {/* 背景纹理 */}
                          <div className="absolute inset-0 opacity-10">
                            <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 to-transparent" />
                          </div>

                          {/* 内容 */}
                          <div className="relative z-10">
                            {/* 姓名 */}
                            <div className="text-white text-3xl md:text-4xl font-bold mb-3 tracking-wider text-center">
                              {w.name}
                            </div>

                            {/* 部门 */}
                            <div className="text-yellow-300/90 text-base md:text-lg text-center tracking-wide">
                              {w.department}
                            </div>
                          </div>

                          {/* 底部装饰线 */}
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-80" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 手动模式：键盘操作提示 */}
                  {drawMode === 'manual' && (
                    <div className="mt-8 flex items-center justify-center gap-6 text-gray-400 text-sm">
                      <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10">
                        <kbd className="px-2 py-1 bg-slate-700 rounded text-xs font-mono">Space</kbd>
                        <span>或</span>
                        <kbd className="px-2 py-1 bg-slate-700 rounded text-xs font-mono">Enter</kbd>
                        <span>继续</span>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10">
                        <span>或点击任意处</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 设置面板 */}
      {showSettings && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* 背景遮罩 */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => {
              setShowSettings(false);
              handleSaveBasicSettings();
            }}
          />

          {/* 主面板 */}
          <div className="relative bg-gradient-to-br from-slate-900/95 to-slate-800/95 border border-yellow-500/30 rounded-3xl w-full max-w-5xl h-[80vh] overflow-hidden shadow-2xl shadow-yellow-500/20">
            {/* 关闭按钮 */}
            <button
              onClick={() => {
                setShowSettings(false);
                handleSaveBasicSettings();
              }}
              className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-slate-800/80 hover:bg-red-600/80 text-gray-400 hover:text-white transition-all duration-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex h-full">
              {/* 左侧导航 */}
              <div className="w-56 bg-slate-900/50 p-4 border-r border-slate-700/50">
                <h2 className="text-xl font-bold text-yellow-400 mb-6 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  系统设置
                </h2>

                <nav className="space-y-1">
                  {[
                    { id: 'basic', label: '基础信息', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
                    { id: 'import', label: '名单导入', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' },
                    { id: 'prizes', label: '奖品设置', icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7' },
                    { id: 'music', label: '背景音乐', icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3' },
                    { id: 'records', label: '中奖记录', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
                    { id: 'personalize', label: '个性化', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                        activeTab === tab.id
                          ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 text-yellow-400 border border-yellow-500/30 shadow-lg shadow-yellow-500/10'
                          : 'text-gray-400 hover:text-white hover:bg-slate-800/50'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                      </svg>
                      <span className="font-medium">{tab.label}</span>
                    </button>
                  ))}
                </nav>
              </div>

              {/* 右侧内容区 */}
              <div className="flex-1 p-8 overflow-y-auto">
                {/* 基础信息 */}
                {activeTab === 'basic' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-2">基础信息</h3>
                      <p className="text-gray-400">配置抽奖活动的基本展示信息</p>
                    </div>

                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">主标题</label>
                        <input
                          type="text"
                          value={mainTitleInput}
                          onChange={(e) => setMainTitleInput(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 focus:ring-2 focus:ring-yellow-500/20 transition-all"
                          placeholder="例如：2026年积极公司"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">副标题</label>
                        <input
                          type="text"
                          value={subTitleInput}
                          onChange={(e) => setSubTitleInput(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 focus:ring-2 focus:ring-yellow-500/20 transition-all"
                          placeholder="例如：元旦抽奖"
                        />
                      </div>

                      {/* 抽奖模式选择 */}
                      <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                        <label className="block text-sm font-medium text-gray-300 mb-3">抽奖模式</label>
                        <div className="space-y-3">
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative">
                              <input
                                type="radio"
                                name="drawMode"
                                checked={drawMode === 'auto'}
                                onChange={() => setDrawMode('auto')}
                                className="sr-only peer"
                              />
                              <div className={`w-5 h-5 rounded-full border-2 transition-all ${
                                drawMode === 'auto'
                                  ? 'border-yellow-500 bg-yellow-500'
                                  : 'border-slate-500 peer-hover:border-yellow-500/50'
                              }`}>
                                {drawMode === 'auto' && (
                                  <div className="absolute inset-1 bg-white rounded-full" />
                                )}
                              </div>
                            </div>
                            <div className="flex-1">
                              <span className="text-white font-medium">自动模式</span>
                              <p className="text-xs text-gray-400">倒计时结束自动停止</p>
                            </div>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative">
                              <input
                                type="radio"
                                name="drawMode"
                                checked={drawMode === 'manual'}
                                onChange={() => setDrawMode('manual')}
                                className="sr-only peer"
                              />
                              <div className={`w-5 h-5 rounded-full border-2 transition-all ${
                                drawMode === 'manual'
                                  ? 'border-yellow-500 bg-yellow-500'
                                  : 'border-slate-500 peer-hover:border-yellow-500/50'
                              }`}>
                                {drawMode === 'manual' && (
                                  <div className="absolute inset-1 bg-white rounded-full" />
                                )}
                              </div>
                            </div>
                            <div className="flex-1">
                              <span className="text-white font-medium">手动模式</span>
                              <p className="text-xs text-gray-400">点击屏幕任意位置停止</p>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* 倒计时时长 - 仅自动模式显示 */}
                      {drawMode === 'auto' && (
                        <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                          <div>
                            <label className="text-sm font-medium text-gray-300">倒计时时长</label>
                            <p className="text-xs text-gray-500 mt-1">自动模式的倒计时秒数</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max="60"
                              value={countdownDuration}
                              onChange={(e) => setCountdownDuration(Math.min(60, Math.max(1, parseInt(e.target.value) || 1)))}
                              className="w-20 px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white text-center focus:outline-none focus:border-yellow-500/50 transition-all"
                            />
                            <span className="text-sm text-gray-400">秒</span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                        <div>
                          <label className="text-sm font-medium text-gray-300">允许重复中奖</label>
                          <p className="text-xs text-gray-500 mt-1">开启后已中奖人员可再次参与抽奖</p>
                        </div>
                        <button
                          onClick={() => setAllowRepeatWinners(!allowRepeatWinners)}
                          className={`relative w-14 h-8 rounded-full transition-all duration-300 ${
                            allowRepeatWinners ? 'bg-yellow-500' : 'bg-slate-600'
                          }`}
                        >
                          <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${
                            allowRepeatWinners ? 'left-7' : 'left-1'
                          }`} />
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveBasicSettings}
                      className="w-full py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 rounded-xl font-semibold text-slate-900 transition-all duration-300 shadow-lg shadow-yellow-500/20"
                    >
                      保存设置
                    </button>
                  </div>
                )}

                {/* 名单导入 */}
                {activeTab === 'import' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-2">名单导入</h3>
                      <p className="text-gray-400">上传参与抽奖的人员名单</p>
                    </div>

                    {/* 文件上传 */}
                    <div className="p-6 bg-slate-800/30 rounded-2xl border border-slate-700/50">
                      <h4 className="text-lg font-semibold text-yellow-400 mb-4">上传文件</h4>
                      <label className="block w-full px-6 py-8 bg-slate-800/50 border-2 border-dashed border-slate-600/50 rounded-xl text-center cursor-pointer hover:border-yellow-500/50 hover:bg-slate-800 transition-all duration-300 group">
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={handleFileImport}
                          className="hidden"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-gray-500 group-hover:text-yellow-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span className="text-gray-400 group-hover:text-gray-300 transition-colors">
                          点击上传 Excel (.xlsx, .xls) 或 CSV 文件
                        </span>
                      </label>
                    </div>

                    {/* 文本粘贴 */}
                    <div className="p-6 bg-slate-800/30 rounded-2xl border border-slate-700/50">
                      <h4 className="text-lg font-semibold text-yellow-400 mb-4">粘贴文本</h4>
                      <p className="text-sm text-gray-400 mb-3">
                        支持从 Excel 复制粘贴或 CSV 格式。格式：姓名,部门（每行一条）
                      </p>
                      <textarea
                        value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)}
                        placeholder="张三,研发部&#10;李四,市场部&#10;王五,销售部"
                        className="w-full h-32 bg-slate-800/50 border border-slate-600/50 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 transition-all resize-none"
                      />
                      <div className="flex gap-3 mt-4">
                        <button
                          onClick={handleTextImport}
                          className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition-colors"
                        >
                          预览
                        </button>
                        {importPreview.length > 0 && (
                          <button
                            onClick={handleConfirmImport}
                            className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-xl font-medium transition-colors"
                          >
                            确认导入
                          </button>
                        )}
                      </div>

                      {importPreview.length > 0 && (
                        <div className="mt-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                          <p className="text-sm text-gray-400 mb-2">预览（前10条）:</p>
                          <div className="grid grid-cols-2 gap-2">
                            {importPreview.map((item, i) => (
                              <div key={i} className="text-sm bg-slate-700/30 rounded-lg px-3 py-2">
                                <span className="text-white">{item.name}</span>
                                <span className="text-gray-400 ml-2">· {item.department}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-center gap-2 py-4 bg-slate-800/30 rounded-xl">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span className="text-gray-300">当前参与人数: <span className="text-yellow-400 font-bold">{allParticipants.length}</span></span>
                    </div>
                  </div>
                )}

                {/* 奖品设置 */}
                {activeTab === 'prizes' && (
                  <div className="flex flex-col h-full">
                    {/* 固定标题栏 */}
                    <div className="flex-shrink-0 pb-4">
                      <h3 className="text-2xl font-bold text-white mb-1">奖品设置</h3>
                      <p className="text-gray-400 text-sm">配置各奖项名称、数量及图片</p>
                    </div>

                    {/* 可滚动的奖项列表 */}
                    <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                      {prizesConfig.map((prize) => (
                        <div
                          key={prize.id}
                          className="group p-5 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-all duration-200"
                        >
                          {/* 表单网格布局 */}
                          <div className="grid grid-cols-12 gap-4">
                            {/* 第一行：奖项名称 (占6列) | 奖品图片 (占6列) */}
                            <div className="col-span-6 space-y-2">
                              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">奖项名称</label>
                              <input
                                type="text"
                                value={prize.name}
                                onChange={(e) => updatePrizeConfig(prize.id, 'name', e.target.value)}
                                className="w-full h-11 px-4 bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/20 transition-all"
                              />
                            </div>

                            <div className="col-span-6 space-y-2">
                              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">奖品图片</label>
                              <div className="flex items-center gap-2">
                                <label className={`flex-1 h-11 flex items-center justify-center gap-2 rounded-lg cursor-pointer transition-all border text-sm ${
                                  prize.image
                                    ? 'bg-green-600/20 text-green-400 border-green-500/30'
                                    : 'bg-black/40 text-gray-400 border-white/10 hover:border-yellow-500/50'
                                }`}>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handlePrizeImageUpload(prize.id, e)}
                                    className="hidden"
                                  />
                                  {prize.image ? (
                                    <>
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      已上传
                                    </>
                                  ) : (
                                    <>
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                      上传图片
                                    </>
                                  )}
                                </label>
                                {prize.image && (
                                  <button
                                    onClick={() => updatePrizeConfig(prize.id, 'image', null)}
                                    className="h-11 px-3 bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 rounded-lg text-sm transition-all"
                                  >
                                    清除
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* 图片预览 */}
                            {prize.image && (
                              <div className="col-span-12 flex justify-center">
                                <div className="p-3 bg-black/30 rounded-lg inline-block">
                                  <img
                                    src={prize.image}
                                    alt={prize.name}
                                    className="h-16 object-contain rounded"
                                  />
                                </div>
                              </div>
                            )}

                            {/* 第二行：总名额 (占3列) | 单次抽取 (占3列) | 删除按钮 (占6列，右对齐) */}
                            <div className="col-span-3 space-y-2">
                              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">总名额</label>
                              <input
                                type="number"
                                min="1"
                                value={prize.count}
                                onChange={(e) => updatePrizeConfig(prize.id, 'count', parseInt(e.target.value) || 1)}
                                className="w-full h-11 px-4 bg-black/40 border border-white/10 rounded-lg text-white text-center focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/20 transition-all"
                              />
                            </div>

                            <div className="col-span-3 space-y-2">
                              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">单次抽取</label>
                              <input
                                type="number"
                                min="1"
                                max={prize.count}
                                value={prize.drawCount || 1}
                                onChange={(e) => updatePrizeConfig(prize.id, 'drawCount', Math.min(parseInt(e.target.value) || 1, prize.count))}
                                className="w-full h-11 px-4 bg-black/40 border border-white/10 rounded-lg text-white text-center focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/20 transition-all"
                              />
                            </div>

                            <div className="col-span-6 flex items-end justify-end pb-0.5">
                              <button
                                onClick={() => deletePrize(prize.id)}
                                className="flex items-center gap-2 px-4 py-2.5 text-gray-500 hover:text-red-400 hover:bg-red-600/10 rounded-lg transition-all duration-200"
                                title="删除奖项"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span className="text-sm font-medium">删除奖项</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* 添加新奖项按钮 - 虚线框 */}
                      <button
                        onClick={addPrize}
                        className="w-full p-4 border-2 border-dashed border-white/20 rounded-xl text-gray-400 hover:text-yellow-400 hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-all duration-200 flex items-center justify-center gap-2 group"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span className="font-medium">添加新奖项</span>
                      </button>
                    </div>

                    {/* 固定底部保存按钮 */}
                    <div className="flex-shrink-0 pt-4 flex justify-end">
                      <button
                        onClick={() => {
                          setSettings({ ...settings, prizes: prizesConfig });
                          saveSettings({ ...settings, prizes: prizesConfig });
                          toastManager.success('奖品设置已保存');
                        }}
                        className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 rounded-full font-semibold text-slate-900 transition-all duration-300 shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/30"
                      >
                        保存设置
                      </button>
                    </div>
                  </div>
                )}

                {/* 背景音乐 */}
                {activeTab === 'music' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-2">背景音乐</h3>
                      <p className="text-gray-400">设置抽奖过程中的背景音乐</p>
                    </div>

                    <div className="p-6 bg-slate-800/30 rounded-2xl border border-slate-700/50 space-y-5">
                      <div className="flex items-center gap-4">
                        <label className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl cursor-pointer font-medium transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                          选择音乐文件
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={handleMusicUpload}
                            className="hidden"
                          />
                        </label>
                        {musicFile && (
                          <div className="flex items-center gap-2 px-4 py-2 bg-green-600/20 text-green-400 border border-green-500/30 rounded-xl">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {musicFile.name}
                            <button
                              onClick={handleClearMusic}
                              className="ml-2 text-red-400 hover:text-red-300"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">音量</span>
                          <span className="text-yellow-400 font-medium">{Math.round(musicVolume * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={musicVolume * 100}
                          onChange={(e) => audioManager.setVolume(e.target.value / 100)}
                          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                        />
                      </div>

                      {/* 抽奖时自动播放开关 */}
                      <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                        <div>
                          <label className="text-sm font-medium text-gray-300">开始抽奖自动播放</label>
                          <p className="text-xs text-gray-500 mt-1">开启后点击开始抽奖时自动播放音乐</p>
                        </div>
                        <button
                          onClick={() => setAutoPlayMusic(!autoPlayMusic)}
                          className={`relative w-14 h-8 rounded-full transition-all duration-300 ${
                            autoPlayMusic ? 'bg-yellow-500' : 'bg-slate-600'
                          }`}
                        >
                          <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${
                            autoPlayMusic ? 'left-7' : 'left-1'
                          }`} />
                        </button>
                      </div>

                      {audioManager.hasMusic() && (
                        <button
                          onClick={() => audioManager.isPlaying ? audioManager.pause() : audioManager.play()}
                          className="w-full py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 rounded-xl font-semibold transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2"
                        >
                          {audioManager.isPlaying ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              暂停
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              播放
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* 中奖记录 */}
                {activeTab === 'records' && (
                  <div className="flex flex-col h-full">
                    {/* 固定标题栏 */}
                    <div className="flex-shrink-0 pb-4">
                      <h3 className="text-2xl font-bold text-white mb-1">中奖记录</h3>
                      <p className="text-gray-400 text-sm">查看和导出中奖名单</p>
                    </div>

                    {/* 工具栏 */}
                    <div className="flex-shrink-0 pb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                        <span className="text-gray-300">共 <span className="text-yellow-400 font-bold">{winners.length}</span> 条记录</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleExportWinners}
                          disabled={winners.length === 0}
                          className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all ${
                            winners.length === 0
                              ? 'bg-gray-700/30 text-gray-500 cursor-not-allowed'
                              : 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white shadow-lg shadow-green-500/20'
                          }`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          导出Excel
                        </button>
                        {winners.length > 0 && (
                          <button
                            onClick={handleClearWinners}
                            className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-600/10 rounded-lg transition-all flex items-center gap-2 text-sm font-medium"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            清空记录
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 表格容器 */}
                    <div className="flex-1 overflow-hidden bg-white/5 rounded-xl border border-white/10">
                      {winners.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-20 text-gray-500">
                          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                          </div>
                          <p className="font-medium">暂无中奖记录</p>
                          <p className="text-sm mt-1">开始抽奖后将在这里显示中奖名单</p>
                        </div>
                      ) : (
                        <div className="h-full overflow-y-auto">
                          <table className="w-full">
                            <thead className="sticky top-0 bg-white/10 backdrop-blur-sm z-10">
                              <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">序号</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">姓名</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">部门</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">奖项</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">中奖时间</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {winners.map((w, i) => (
                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                  <td className="px-6 py-4">
                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white text-sm font-bold">
                                      {i + 1}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className="text-base font-semibold text-white">{w.name}</span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className="text-sm text-gray-400">{w.department}</span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className={`inline-block px-3 py-1.5 border rounded-full text-sm font-medium ${getPrizeBadgeStyles(w.prizeName)}`}>
                                      {w.prizeName || '-'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className="text-sm font-mono text-gray-500">{w.winTimeStr}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 个性化 */}
                {activeTab === 'personalize' && (
                  <div className="flex flex-col h-full">
                    {/* 固定标题栏 */}
                    <div className="flex-shrink-0 pb-4">
                      <h3 className="text-2xl font-bold text-white mb-1">个性化设置</h3>
                      <p className="text-gray-400 text-sm">配置指定名单（内定）和黑名单</p>
                    </div>

                    {/* 可滚动内容区 */}
                    <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                      {/* ====== 指定名单区域 ====== */}
                      <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold text-yellow-400">指定名单（内定）</h4>
                            <p className="text-xs text-gray-500">设置必中某奖项的人员</p>
                          </div>
                        </div>

                        {/* 添加表单 */}
                        <div className="space-y-4 p-4 bg-black/30 rounded-xl mb-4">
                          {/* 选择奖项 */}
                          <div>
                            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">选择奖项</label>
                            <select
                              value={designatedPrizeId}
                              onChange={(e) => setDesignatedPrizeId(Number(e.target.value))}
                              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:border-yellow-500/50 transition-all"
                            >
                              <option value="">请选择奖项</option>
                              {prizesConfig.map(prize => (
                                <option key={prize.id} value={prize.id}>{prize.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* 选择人员 */}
                          <div>
                            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">选择人员</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={designatedSearchQuery}
                                onChange={(e) => setDesignatedSearchQuery(e.target.value)}
                                onFocus={() => setDesignatedDropdownOpen(true)}
                                onBlur={() => setTimeout(() => setDesignatedDropdownOpen(false), 200)}
                                placeholder="搜索姓名或部门..."
                                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 transition-all"
                              />
                              {designatedDropdownOpen && designatedSearchQuery && (
                                <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-600/50 rounded-xl max-h-60 overflow-y-auto shadow-xl">
                                  {getAvailableParticipantsForDesignated().length > 0 ? (
                                    getAvailableParticipantsForDesignated().map(person => (
                                      <button
                                        key={person.id}
                                        onClick={() => {
                                          setDesignatedSelectedPerson(person);
                                          setDesignatedSearchQuery(person.name);
                                          setDesignatedDropdownOpen(false);
                                        }}
                                        className="w-full px-4 py-3 text-left hover:bg-slate-700/50 transition-colors flex items-center justify-between"
                                      >
                                        <div>
                                          <span className="text-white font-medium">{person.name}</span>
                                          <span className="text-gray-400 text-sm ml-2">· {person.department}</span>
                                        </div>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                      </button>
                                    ))
                                  ) : (
                                    <div className="px-4 py-3 text-gray-500 text-center">无可用人员</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 添加按钮 */}
                          <button
                            onClick={handleAddDesignatedPerson}
                            disabled={!designatedPrizeId || !designatedSelectedPerson}
                            className={`w-full py-3 rounded-xl font-semibold transition-all ${
                              !designatedPrizeId || !designatedSelectedPerson
                                ? 'bg-gray-700/30 text-gray-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-slate-900 shadow-lg shadow-yellow-500/20'
                            }`}
                          >
                            添加到指定名单
                          </button>
                        </div>

                        {/* 指定名单列表 - 按奖项分组显示 */}
                        <div className="space-y-4">
                          {Object.keys(designatedList.designatedList).length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                              <p>暂无指定名单</p>
                            </div>
                          ) : (
                            Object.entries(designatedList.designatedList).map(([prizeId, persons]) => {
                              const prize = prizesConfig.find(p => p.id === Number(prizeId));
                              return (
                                <div key={prizeId} className="p-4 bg-black/20 rounded-xl">
                                  <div className="flex items-center justify-between mb-3">
                                    <h5 className="text-yellow-400 font-semibold">{prize?.name || `奖项 ${prizeId}`}</h5>
                                    <span className="text-xs text-gray-500">{persons.length} 人</span>
                                  </div>
                                  <div className="space-y-2">
                                    {persons.map(person => (
                                      <div
                                        key={person.id}
                                        className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg group hover:bg-white/10 transition-colors"
                                      >
                                        <div className="flex items-center gap-3">
                                          <img
                                            src={person.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(person.name)}`}
                                            alt={person.name}
                                            className="w-8 h-8 rounded-full"
                                          />
                                          <div>
                                            <span className="text-white font-medium">{person.name}</span>
                                            <span className="text-gray-400 text-sm ml-2">· {person.department}</span>
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => handleRemoveDesignatedPerson(Number(prizeId), person.id)}
                                          className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:text-red-300 hover:bg-red-600/10 rounded-lg transition-all"
                                          title="移除"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* ====== 黑名单区域 ====== */}
                      <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold text-red-400">黑名单</h4>
                            <p className="text-xs text-gray-500">设置不能中奖的人员</p>
                          </div>
                        </div>

                        {/* 添加表单 */}
                        <div className="space-y-4 p-4 bg-black/30 rounded-xl mb-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">选择人员</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={blacklistSearchQuery}
                                onChange={(e) => setBlacklistSearchQuery(e.target.value)}
                                onFocus={() => setBlacklistDropdownOpen(true)}
                                onBlur={() => setTimeout(() => setBlacklistDropdownOpen(false), 200)}
                                placeholder="搜索姓名或部门..."
                                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 transition-all"
                              />
                              {blacklistDropdownOpen && blacklistSearchQuery && (
                                <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-600/50 rounded-xl max-h-60 overflow-y-auto shadow-xl">
                                  {getAvailableParticipantsForBlacklist().length > 0 ? (
                                    getAvailableParticipantsForBlacklist().map(person => (
                                      <button
                                        key={person.id}
                                        onClick={() => {
                                          setBlacklistSelectedPerson(person);
                                          setBlacklistSearchQuery(person.name);
                                          setBlacklistDropdownOpen(false);
                                        }}
                                        className="w-full px-4 py-3 text-left hover:bg-slate-700/50 transition-colors flex items-center justify-between"
                                      >
                                        <div>
                                          <span className="text-white font-medium">{person.name}</span>
                                          <span className="text-gray-400 text-sm ml-2">· {person.department}</span>
                                        </div>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                      </button>
                                    ))
                                  ) : (
                                    <div className="px-4 py-3 text-gray-500 text-center">无可用人员</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={handleAddBlacklistPerson}
                            disabled={!blacklistSelectedPerson}
                            className={`w-full py-3 rounded-xl font-semibold transition-all ${
                              !blacklistSelectedPerson
                                ? 'bg-gray-700/30 text-gray-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-lg shadow-red-500/20'
                            }`}
                          >
                            添加到黑名单
                          </button>
                        </div>

                        {/* 黑名单列表 */}
                        <div className="space-y-2">
                          {blacklist.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                              <p>暂无黑名单</p>
                            </div>
                          ) : (
                            blacklist.map(person => (
                              <div
                                key={person.id}
                                className="flex items-center justify-between px-4 py-3 bg-black/20 rounded-xl group hover:bg-black/30 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <img
                                    src={person.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(person.name)}`}
                                    alt={person.name}
                                    className="w-10 h-10 rounded-full"
                                  />
                                  <div>
                                    <span className="text-white font-medium">{person.name}</span>
                                    <span className="text-gray-400 text-sm ml-2">· {person.department}</span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleRemoveBlacklistPerson(person.id)}
                                  className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:text-red-300 hover:bg-red-600/10 rounded-lg transition-all"
                                  title="移除"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
