// 模拟抽奖数据 - 500 条
const departments = [
  '研发部', '市场部', '销售部', '人事部', '财务部',
  '产品部', '运营部', '客服部', '设计部', '技术部',
  '运维部', '测试部', '行政部', '采购部', '法务部'
];

const lastNames = [
  '王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴',
  '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗',
  '梁', '宋', '郑', '谢', '韩', '唐', '冯', '于', '董', '萧',
  '程', '曹', '袁', '邓', '许', '傅', '沈', '曾', '彭', '吕',
  '苏', '卢', '蒋', '蔡', '贾', '丁', '魏', '薛', '叶', '阎',
  '余', '潘', '杜', '戴', '夏', '钟', '汪', '田', '任', '姜',
  '范', '方', '石', '姚', '谭', '廖', '邹', '熊', '金', '陆',
  '郝', '孔', '白', '崔', '康', '毛', '邱', '秦', '江', '史'
];

const firstNames = [
  '伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋',
  '勇', '艳', '杰', '娟', '涛', '明', '超', '秀英', '娟', '英',
  '华', '红', '平', '飞', '桂英', '明', '秀英', '丽', '强', '磊',
  '鑫', '琳', '萍', '燕', '淑', '凤', '德', '志', '建国', '国强',
  '春', '晓', '建', '玉', '婷', '雪', '惠', '文', '晨', '宇',
  '浩', '俊', '欣', '怡', '婷', '嘉', '雨', '泽', '子轩', '浩然',
  '宇轩', '子涵', '一诺', '欣然', '俊杰', '宇航', '雨欣', '子墨',
  '思远', '雨桐', '梓萱', '梦洁', '皓轩', '梓涵', '诗涵', '佳琪',
  '子豪', '天宇', '雪怡', '雅琪', '宇彤', '雨萱', '欣怡', '诗琪',
  '子瑞', '浩宇', '雨泽', '子轩', '浩然', '欣怡', '梓萱', '梦洁'
];

function generateName() {
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const firstName1 = firstNames[Math.floor(Math.random() * firstNames.length)];
  const firstName2 = Math.random() > 0.4 ? firstNames[Math.floor(Math.random() * firstNames.length)] : '';
  return lastName + firstName1 + firstName2;
}

function generateDepartment() {
  return departments[Math.floor(Math.random() * departments.length)];
}

export const mockPrizes = Array.from({ length: 500 }, (_, i) => ({
  id: i + 1,
  name: generateName(),
  department: generateDepartment(),
  // 使用 Dicebear API 生成头像
  avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 1}&backgroundColor=b6e3f4`
}));
