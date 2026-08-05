// netlify/functions/gerar-carta.js
// Function segura: recebe dados do formulário, chama a Groq com a chave protegida no servidor,
// e devolve { texto: "..." } para o frontend renderizar no cartão.

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async function (event) {
  // Preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Método não permitido. Use POST.' })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'JSON inválido no corpo da requisição.' })
    };
  }

  const { nomePai, caracteristicas, estilo } = payload;

  if (!nomePai || !caracteristicas) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Campos obrigatórios ausentes: nomePai e caracteristicas.' })
    };
  }

  const estiloMap = {
    emocionante: 'profundamente emocionante, caloroso, capaz de emocionar até as lágrimas',
    divertido: 'divertido, leve e bem-humorado, mas ainda carinhoso',
    serio: 'sério, respeitoso e elegante, sem perder o afeto'
  };
  const tomDescricao = estiloMap[estilo] || estiloMap.emocionante;

  const promptSistema = `Você é um escritor premium especializado em cartas de homenagem para o Dia dos Pais. Escreva textos originais, pessoais e emocionantes — nunca genéricos ou clichês. Estruture o texto em parágrafos curtos, pensados para leitura confortável em tela de celular. Nunca inclua saudações introdutórias como "Aqui está sua carta" ou comentários fora do texto — entregue apenas o corpo da homenagem, pronto para ser lido pelo pai homenageado.`;

  const promptUsuario = `Escreva uma carta de Dia dos Pais para "${nomePai}", escrita na perspectiva de um(a) filho(a).
Tom da carta: ${tomDescricao}.
Memórias e características a incorporar naturalmente no texto (não liste, integre à narrativa): ${caracteristicas}.
Tamanho: entre 120 e 180 palavras, dividido em 2 a 3 parágrafos curtos.
Finalize com uma frase de impacto emocional.`;

  try {
    const groqResponse = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: promptSistema },
          { role: 'user', content: promptUsuario }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!groqResponse.ok) {
      const errorBody = await groqResponse.text();
      throw new Error(`Groq respondeu com status ${groqResponse.status}: ${errorBody}`);
    }

    const data = await groqResponse.json();
    const texto = data?.choices?.[0]?.message?.content?.trim();

    if (!texto) {
      throw new Error('A resposta da Groq não retornou texto utilizável.');
    }

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto })
    };

  } catch (err) {
    console.error('Erro ao gerar carta via Groq:', err.message);
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Falha ao gerar a carta. Tente novamente em instantes.', detalhe: err.message })
    };
  }
};
