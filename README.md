# IT선정 도입의뢰 사전검토 게시판

사내 IT 도입 사전검토용 게시판입니다. 의뢰자(신청자)는 도입 건을 등록하고 본인이 등록한 건만 조회할 수 있고,
관리자(선정담당자)는 전체 건을 조회하며 검토 의견을 남기고 검토완료 처리를 할 수 있습니다.

## 1. 기능 요약

- 회원가입/로그인 (아이디/비밀번호, 세션 기반)
- 역할: `의뢰자`(requester, 기본값) / `관리자`(admin)
- 도입의뢰 등록 항목: 요청일자, 사업명, 의뢰자(이름/사번/부서, 로그인 계정에서 자동 반영), 구매대상(H/W, S/W 개발용역(SI), 클라우드, 기타 — 다중 선택), 예산(VAT 포함), 부가세 환급 대상 여부, 사업계획번호, 불용 매각 여부, 특이사항(자유 텍스트)
- 첨부파일 7종 (각각 선택, 다중 업로드 가능): 세부구매내역 / 기술검토 결과서 / 보안성검토 / 구축요건정의서 / 사업승인문서 / 예산배정문서 / 사업추진안
- 목록: 상태/구매대상/연도/사업명 검색 필터, 의뢰자는 본인 건만, 관리자는 전체 건 조회
- 상세페이지: 관리자만 검토 의견(코멘트+파일첨부) 작성 가능, "검토완료" 버튼 클릭 시 상태 변경 및 목록에서 회색으로 표시(필요 시 "검토중으로 되돌리기"로 취소 가능)

**범위에서 제외한 기능 (필요 시 추가 개발 가능)**: 검토완료 시 의뢰자에게 쪽지/알림 발송, 회사 SSO/사번 연동 로그인, 관리자 승격을 위한 화면(현재는 DB에서 직접 처리).

## 2. 요구사항

- Docker + Docker Compose 사용을 권장합니다. (Docker가 어렵다면 3-B의 Node.js 직접 실행도 가능합니다)
- Node.js를 직접 쓸 경우: Node.js 20.x 이상

## 3-A. 설치 및 실행 (Docker, 권장)

이 폴더에 `Dockerfile`, `docker-compose.yml`이 포함되어 있습니다.

```bash
# 1) 이미지 빌드 (최초 1회, node:20-bookworm-slim 베이스 이미지를 받기 위해 인터넷/사내 이미지 레지스트리 접근이 필요합니다)
docker compose build

# 2) 실행 (백그라운드)
docker compose up -d

# 3) 로그 확인
docker compose logs -f
```

기본적으로 3000번 포트로 열립니다 (`http://서버주소:3000`). 포트를 바꾸려면 `docker-compose.yml`의
`ports` 항목에서 왼쪽 숫자(호스트 포트)만 수정하면 됩니다. 예: `"80:3000"`

이 앱은 네이티브(C++) 모듈을 전혀 쓰지 않는 순수 JavaScript 구성이라 `docker compose build`는
Node 베이스 이미지 pull + `npm ci` 딱 두 단계만 하면 되고, 빌드 도구(python/make/g++) 설치도 필요 없습니다.
그만큼 사내망/보안이 엄격한 빌드 환경에서도 실패할 여지가 적습니다.

> **인터넷이 완전히 차단된 서버(에어갭)라면?**
> `docker compose build`는 Node 베이스 이미지를 받기 위해 최소한의 인터넷(또는 사내 Docker 레지스트리 미러) 접근이
> 필요합니다. 만약 실제로 배포할 서버가 완전히 인터넷 차단 환경이라면, 인터넷이 되는 다른 PC/빌드서버에서
> 이 폴더 그대로 `docker build -t it-review-board:latest .` 후
> `docker save it-review-board:latest -o it-review-board.tar` 로 이미지를 파일로 추출해서 내부망 서버로 옮긴 뒤,
> 서버에서 `docker load -i it-review-board.tar` 로 불러와서 `docker compose up -d` 하면 됩니다.
> (참고: 이 이미지는 제가 지금 작업 중인 실행 환경에서는 Docker Hub 접근 자체가 막혀 있어 미리 빌드해서
> tar 파일로 드리지 못했습니다. Dockerfile과 모든 설정 파일은 완성되어 있으니, 인터넷이 되는 PC에서
> 위 명령어 두 줄만 실행하면 바로 이미지가 만들어집니다.)

데이터(사용자/도입의뢰/첨부파일/로그인 세션)는 `./data` 폴더에 저장되며, 컨테이너를 재시작/재배포해도 유지됩니다.
이 폴더는 정기적으로 백업해주세요.

## 3-B. 설치 및 실행 (Node.js 직접 실행)

```bash
npm install
npm start
```

기본 포트는 3000이며, 환경변수로 바꿀 수 있습니다: `PORT=8080 npm start`

운영 환경에서는 프로세스가 죽었을 때 자동 재시작되도록 `pm2`나 `systemd` 서비스 등록을 권장합니다.

## 4. 최초 로그인 / 계정 관리

최초 실행 시 관리자 계정이 자동 생성됩니다.

- 아이디: `admin`
- 비밀번호: `admin1234`

**반드시 최초 로그인 후 비밀번호를 변경해주세요** (로그인 후 `/api/auth/change-password` API 또는 추후 설정 화면 추가 권장).

일반 사용자는 `/register.html`에서 직접 가입하면 `의뢰자` 권한으로 생성됩니다. 특정 사용자를 `관리자`로
승격하려면, 서버를 잠깐 멈춘 뒤 `data/db.json` 파일에서 해당 사용자의 `"role"` 값을 `"requester"`에서
`"admin"`으로 바꾸고 다시 실행하면 됩니다. (텍스트 에디터로 열어서 사용자의 `username`을 찾아 수정하면 됩니다)

## 5. 보안 관련 주의사항 (배포 전 꼭 확인)

- `docker-compose.yml`의 `SESSION_SECRET` 값을 임의의 긴 무작위 문자열로 변경하세요.
- 기본 관리자 비밀번호(`admin1234`)를 반드시 변경하세요.
- 사내망 안에서만 접근 가능하도록(VPN/인트라넷 대역) 방화벽·리버스프록시 설정을 권장합니다.
- HTTPS가 필요하면 아래 6번의 nginx 예시처럼 리버스프록시에서 TLS를 종료시켜 주세요.

## 6. 리버스프록시(nginx) 예시

사내 도메인/HTTPS로 접근하게 하려면 nginx 등에서 아래처럼 프록시하면 됩니다.

```nginx
server {
    listen 443 ssl;
    server_name it-review.internal.company.com;

    ssl_certificate     /etc/ssl/certs/company.crt;
    ssl_certificate_key /etc/ssl/private/company.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 60m; # 파일 첨부 용량 제한(50MB/파일)보다 넉넉하게
    }
}
```

## 7. 데이터 백업

`data/` 폴더(Docker의 경우 볼륨 마운트된 `./data`) 안에 다음이 저장됩니다.

- `db.json` : 전체 데이터(사용자, 도입의뢰 건, 검토의견 등)가 담긴 파일
- `uploads/` : 첨부파일 원본
- `sessions/` : 로그인 세션 파일 (백업 불필요, 유실되어도 재로그인만 하면 됨)

`db.json`과 `uploads/` 폴더만 정기적으로 백업하면 됩니다. (둘 다 그냥 파일/폴더라서 압축해서 복사하는 것만으로 백업이 됩니다)

## 8. 폴더 구조

```
server.js              앱 진입점
src/store.js             데이터 저장소(JSON 파일 기반) 초기화, 최초 관리자 계정 시드
src/auth.js              로그인/권한 체크 미들웨어
src/constants.js          구매대상/첨부파일 카테고리 정의
src/routes/auth.js        회원가입/로그인/로그아웃 API
src/routes/requests.js    도입의뢰 등록/목록/상세/검토완료/의견 API
public/                  프론트엔드 (로그인, 목록, 등록, 상세 화면)
data/                    실행 시 자동 생성되는 데이터(db.json)/업로드파일/세션 저장 폴더
Dockerfile, docker-compose.yml   배포용 컨테이너 설정
```

### 왜 SQLite/DB 서버 대신 JSON 파일을 쓰나요?

`better-sqlite3` 같은 라이브러리는 설치할 때 C++로 된 부분을 서버에서 직접 컴파일해야 하는데, 이 컴파일 과정이
사내망처럼 외부 접속이 제한된 환경에서 종종 실패합니다(실제로 이 프로젝트를 준비하던 제 작업 환경에서도
그 문제가 발생해서 원인을 확인하고 지금 방식으로 바꿨습니다). 그래서 순수 자바스크립트로 동작하는 파일 기반
저장소로 구성했습니다. Node.js는 요청을 한 번에 하나씩 순서대로 처리하기 때문에 여러 사람이 동시에 등록/조회해도
데이터가 꼬이지 않고, 이 게시판 정도의 사용량(사내 소수 인원이 쓰는 사전검토 게시판)에는 충분한 성능입니다.
다만 등록 건수가 수만 건 이상으로 매우 많아지거나 훨씬 큰 트래픽이 예상된다면, 그때는 PostgreSQL 같은 정식
DB 서버로 옮기는 것을 검토해보시면 됩니다.

## 9. 향후 개선 아이디어

- 검토완료 시 의뢰자에게 알림(사내 메신저 연동 또는 이메일) 발송
- 회사 SSO/LDAP 연동 로그인
- 관리자 계정 관리 화면(현재는 DB 직접 수정 필요)
- 등록 후 의뢰자 본인의 수정/삭제 기능 (현재는 등록만 가능)
