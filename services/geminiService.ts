import { GoogleGenAI } from "@google/genai";
import { Team, Match } from "../types";

const analyzeLeague = async (
  teams: Team[], 
  fixtures: Match[]
): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return "Hata: API anahtarı bulunamadı. Lütfen çevre değişkenlerini kontrol edin.";
    }

    const ai = new GoogleGenAI({ apiKey });

    // Format data for the prompt
    const standingsText = teams.map((t, index) => 
      `${index + 1}. ${t.name} - P: ${t.pts}, Av: ${t.gd}, O: ${t.played}`
    ).join('\n');

    const nextFixtures = fixtures
      .filter(f => !f.isPlayed)
      .slice(0, 8) // Just the immediate next matches
      .map(f => {
        const home = teams.find(t => t.id === f.homeTeamId)?.name;
        const away = teams.find(t => t.id === f.awayTeamId)?.name;
        return `${home} vs ${away}`;
      }).join('\n');

    const prompt = `
      Sen uzman bir Türk futbol yorumcususun. Aşağıdaki Nesine 3. Lig 3. Grup puan durumunu ve gelecek fikstürü analiz et.
      
      Özellikle "Karabük İdman Yurdu" takımına odaklan.
      
      Şu anki Puan Durumu:
      ${standingsText}

      Gelecek Maçlar:
      ${nextFixtures}

      Lütfen şu formatta kısa bir analiz yap:
      1. Karabük İdman Yurdu'nun mevcut durumu ve şampiyonluk veya play-off şansı.
      2. Ligin zirvesindeki çekişme.
      3. Gelecek haftaki kritik maçlar.
      
      Yorumların tarafsız ama heyecan verici olsun. Türkçe yanıt ver.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Analiz oluşturulamadı.";

  } catch (error) {
    console.error("Gemini API Hatası:", error);
    return "Analiz sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyiniz.";
  }
};

export { analyzeLeague };