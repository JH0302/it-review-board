FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./server.js
COPY src ./src
COPY public ./public

# 데이터베이스(JSON)/첨부파일/세션 파일이 저장되는 디렉터리. 컨테이너를 재시작/재배포해도
# 데이터가 남아있으려면 반드시 이 경로를 볼륨으로 마운트하세요 (docker-compose.yml 참고).
VOLUME ["/app/data"]

EXPOSE 3000
CMD ["node", "server.js"]
