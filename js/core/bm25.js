/**
 * [v1.0.0] BM25 Okapi 랭킹 알고리즘 (순수 JS 구현)
 * 원본: rank_bm25.BM25Okapi (Python) → 순수 JavaScript 재구현
 * 행 단위 문서에 대한 관련도 점수를 계산합니다.
 */

export class BM25 {
    /**
     * @param {number} k1 - 용어 빈도 포화 파라미터 (기본값 1.5)
     * @param {number} b - 문서 길이 정규화 파라미터 (기본값 0.75)
     */
    constructor(k1 = 1.5, b = 0.75) {
        this.k1 = k1;
        this.b = b;

        // 코퍼스 관련 상태
        this.corpus = [];           // 문서별 토큰 배열
        this.docLengths = [];       // 문서별 길이
        this.avgDocLength = 0;      // 평균 문서 길이
        this.docCount = 0;          // 총 문서 수
        this.df = new Map();        // 용어 → 문서 빈도 (DF)
        this.idf = new Map();       // 용어 → 역문서 빈도 (IDF)
        this.tf = [];               // 문서별 용어 빈도 Map 배열
    }

    /**
     * 코퍼스로부터 BM25 인덱스를 구축합니다.
     * @param {string[][]} corpus - 문서별 토큰 배열 (예: [['hello','world'], ['foo','bar']])
     */
    buildIndex(corpus) {
        this.corpus = corpus;
        this.docCount = corpus.length;
        this.docLengths = [];
        this.df = new Map();
        this.tf = [];

        // 1단계: 문서 빈도(DF) 및 용어 빈도(TF) 계산
        let totalLength = 0;
        for (let i = 0; i < corpus.length; i++) {
            const doc = corpus[i];
            this.docLengths.push(doc.length);
            totalLength += doc.length;

            // 현재 문서에서 등장하는 고유 용어 집합
            const seenTerms = new Set();
            // 용어 빈도 맵
            const tfMap = new Map();

            for (const token of doc) {
                tfMap.set(token, (tfMap.get(token) || 0) + 1);
                seenTerms.add(token);
            }

            this.tf.push(tfMap);

            // 문서 빈도 갱신 (용어가 등장한 문서 수)
            for (const term of seenTerms) {
                this.df.set(term, (this.df.get(term) || 0) + 1);
            }
        }

        // 평균 문서 길이
        this.avgDocLength = this.docCount > 0 ? totalLength / this.docCount : 0;

        // 2단계: IDF 계산 (로그 스무딩 적용)
        this.idf = new Map();
        for (const [term, freq] of this.df) {
            // BM25 Okapi IDF 공식: log((N - n + 0.5) / (n + 0.5) + 1)
            const numerator = this.docCount - freq + 0.5;
            const denominator = freq + 0.5;
            this.idf.set(term, Math.log(numerator / denominator + 1));
        }
    }

    /**
     * 쿼리 토큰에 대한 각 문서의 BM25 점수를 반환합니다.
     * @param {string[]} queryTokens - 쿼리 토큰 배열
     * @returns {number[]} 문서별 점수 배열
     */
    getScores(queryTokens) {
        const scores = new Array(this.docCount).fill(0);

        for (const token of queryTokens) {
            const tokenIdf = this.idf.get(token);
            // IDF가 없으면 (코퍼스에 없는 용어) 스킵
            if (tokenIdf === undefined) continue;

            for (let i = 0; i < this.docCount; i++) {
                const freq = this.tf[i].get(token) || 0;
                if (freq === 0) continue;

                const docLen = this.docLengths[i];
                // BM25 점수 공식
                const numerator = freq * (this.k1 + 1);
                const denominator = freq + this.k1 * (1 - this.b + this.b * (docLen / this.avgDocLength));
                scores[i] += tokenIdf * (numerator / denominator);
            }
        }

        return scores;
    }

    /**
     * 쿼리에 대해 점수가 0보다 큰 문서만 Map으로 반환합니다.
     * @param {string[]} queryTokens - 쿼리 토큰 배열
     * @returns {Map<number, number>} 문서 인덱스 → 점수
     */
    getScoresMap(queryTokens) {
        const scores = this.getScores(queryTokens);
        const result = new Map();
        for (let i = 0; i < scores.length; i++) {
            if (scores[i] > 0) {
                result.set(i, scores[i]);
            }
        }
        return result;
    }
}
