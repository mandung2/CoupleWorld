-- 기록 사진 여러 장(최대 5장): 사진 URL 배열을 JSON 문자열로 저장.
-- photo 컬럼은 대표(첫 번째) 사진으로 계속 채워 둡니다.
ALTER TABLE memories ADD COLUMN photos TEXT;
