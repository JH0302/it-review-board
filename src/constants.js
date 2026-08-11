// 첨부파일: 문서 종류 구분 없이 단일 카테고리로 통합
const FILE_CATEGORIES = [
  { key: 'attachment', label: '첨부파일' },
];
const FILE_CATEGORY_KEYS = FILE_CATEGORIES.map((c) => c.key);

// 구매대상 (다중 선택)
const PURCHASE_TYPES = [
  { key: 'hw', label: 'H/W' },
  { key: 'sw', label: 'S/W' },
  { key: 'si', label: '개발용역' },
  { key: 'lease_sw', label: '임차 S/W' },
  { key: 'etc', label: '기타' },
];
const PURCHASE_TYPE_KEYS = PURCHASE_TYPES.map((c) => c.key);

// 사전검토 구분 (구매 / 유지보수 탭)
const REQUEST_CATEGORIES = [
  { key: 'purchase', label: '구매' },
  { key: 'maintenance', label: '유지보수' },
];
const REQUEST_CATEGORY_KEYS = REQUEST_CATEGORIES.map((c) => c.key);

module.exports = {
  FILE_CATEGORIES,
  FILE_CATEGORY_KEYS,
  PURCHASE_TYPES,
  PURCHASE_TYPE_KEYS,
  REQUEST_CATEGORIES,
  REQUEST_CATEGORY_KEYS,
};
