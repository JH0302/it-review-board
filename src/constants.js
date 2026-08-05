// 첨부파일 카테고리: 공통(맨 앞) + 구매/유지보수 전용 + 공통(맨 뒤)
const COMMON_FILE_CATEGORIES_FIRST = [
  { key: 'pre_estimate', label: '사전견적서' },
];
const PURCHASE_FILE_CATEGORIES = [
  { key: 'purchase_introduction_request', label: '도입의뢰 문서' },
  { key: 'purchase_detail', label: '세부구매내역' },
  { key: 'disposal_detail', label: '불용매각 상세' },
  { key: 'build_requirements', label: '구축요건정의서' },
  { key: 'tech_review', label: '기술검토 결과서' },
  { key: 'security_review', label: '보안성검토결과서' },
  { key: 'biz_proposal', label: '사업추진안(부의자료)' },
  { key: 'biz_approval', label: '사업승인문서' },
  { key: 'budget_allocation', label: '예산배정문서' },
];
const MAINTENANCE_FILE_CATEGORIES = [
  { key: 'biz_budget_request', label: '사업추진의뢰 및 예산배정 요청 문서' },
  { key: 'proposal_doc', label: '추진(안)' },
  { key: 'introduction_request', label: '도입의뢰' },
  { key: 'auto_renewal_checklist', label: '자동연장체크리스트' },
];
const COMMON_FILE_CATEGORIES_LAST = [
  { key: 'etc_required_doc', label: '기타 필요 문서' },
];
const FILE_CATEGORIES = [
  ...COMMON_FILE_CATEGORIES_FIRST,
  ...PURCHASE_FILE_CATEGORIES,
  ...MAINTENANCE_FILE_CATEGORIES,
  ...COMMON_FILE_CATEGORIES_LAST,
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
  COMMON_FILE_CATEGORIES_FIRST,
  PURCHASE_FILE_CATEGORIES,
  MAINTENANCE_FILE_CATEGORIES,
  COMMON_FILE_CATEGORIES_LAST,
  FILE_CATEGORIES,
  FILE_CATEGORY_KEYS,
  PURCHASE_TYPES,
  PURCHASE_TYPE_KEYS,
  REQUEST_CATEGORIES,
  REQUEST_CATEGORY_KEYS,
};
