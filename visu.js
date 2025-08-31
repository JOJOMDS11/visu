// Configuração do Firebase a partir das variáveis de ambiente do Netlify
const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Fallback para configuração direta (caso as env vars não funcionem)
const FIREBASE_CONFIG_FALLBACK = {
  apiKey: "AIzaSyD2StS7Gz-ikxyt8kc0cSRzF_e7eL3FeiM",
  authDomain: "jojovius-f5de7.firebaseapp.com",
  databaseURL: "https://jojovius-f5de7-default-rtdb.firebaseio.com",
  projectId: "jojovius-f5de7",
  storageBucket: "jojovius-f5de7.appspot.com",
  messagingSenderId: "629248865232",
  appId: "1:629248865232:web:4e74d888f57161cedfffd5"
};

class HaxballStatsTracker {
  constructor() {
    this.currentAPI = 'firebase';
    this.firebaseInitialized = false;

    // Tenta usar as variáveis de ambiente, se não conseguir usa o fallback
    let config = FIREBASE_CONFIG;
    const hasValidEnvVars = Object.values(FIREBASE_CONFIG).every(key => key && key !== 'undefined');
    
    if (!hasValidEnvVars) {
      console.log('Variáveis de ambiente não encontradas, usando configuração fallback');
      config = FIREBASE_CONFIG_FALLBACK;
    }

    // Inicializa o Firebase
    try {
      if (Object.values(config).every(key => key)) {
        if (!firebase.apps.length) {
          firebase.initializeApp(config);
        }
        this.db = firebase.database();
        this.firebaseInitialized = true;
        console.log('Firebase inicializado com sucesso');
        console.log('Configuração usada:', {
          projectId: config.projectId,
          authDomain: config.authDomain
        });
      } else {
        throw new Error('Configuração do Firebase incompleta.');
      }
    } catch (error) {
      console.error('Erro ao inicializar Firebase:', error);
      this.showMessage('❌ Erro ao conectar com Firebase. Usando modo demo.', true);
      this.currentAPI = 'demo';
    }
    
    this.apis = {
      firebase: {
        name: 'Firebase',
        get: async (key) => {
          if (!this.firebaseInitialized) throw new Error('Firebase não inicializado');
          try {
            const snapshot = await this.db.ref(`stats/${key}`).once('value');
            return snapshot.val() || 0;
          } catch (error) {
            console.error('Erro Firebase get:', error);
            return 0;
          }
        },
        increment: async (key, amount = 1) => {
          if (!this.firebaseInitialized) throw new Error('Firebase não inicializado');
          try {
            await this.db.ref(`stats/${key}`).transaction((current) => {
              return (current || 0) + amount;
            });
            const snapshot = await this.db.ref(`stats/${key}`).once('value');
            return snapshot.val() || 0;
          } catch (error) {
            console.error('Erro Firebase increment:', error);
            return 0;
          }
        }
      },
      demo: {
        name: 'Dados Demo',
        data: {
          totalVisits: 3500,
          todayVisits: 85,
          discordClicks: 120,
          langPt: 450,
          langEn: 300,
          langTr: 150
        },
        get: async (key) => {
          await new Promise(resolve => setTimeout(resolve, 300));
          return this.apis.demo.data[key] || 0;
        },
        increment: async (key, amount = 1) => {
          await new Promise(resolve => setTimeout(resolve, 200));
          this.apis.demo.data[key] = (this.apis.demo.data[key] || 0) + amount;
          return this.apis.demo.data[key];
        }
      }
    };
    
    this.counters = {
      totalVisits: 'totalVisits',
      todayVisits: 'todayVisits_' + new Date().toISOString().split('T')[0],
      discordClicks: 'discordClicks',
      langPt: 'langPt',
      langEn: 'langEn',
      langTr: 'langTr',
      langEs: 'langEs'
    };
  }

  async getCurrentAPI() {
    return this.apis[this.currentAPI];
  }

  async get(key) {
    const api = await this.getCurrentAPI();
    return await api.get(key);
  }

  async increment(key, amount = 1) {
    const api = await this.getCurrentAPI();
    return await api.increment(key, amount);
  }

  setStatus(elementId, isOnline) {
    const element = document.getElementById(elementId);
    if (element) {
      element.className = `status-indicator ${isOnline ? 'status-online' : 'status-offline'}`;
    }
  }

  showMessage(message, isError = false) {
    const statusDiv = document.getElementById('statusMessage');
    if (statusDiv) {
      statusDiv.innerHTML = `
        <div class="${isError ? 'error-message' : 'success-message'}">
          ${message}
        </div>
      `;
      setTimeout(() => {
        statusDiv.innerHTML = '';
      }, 5000);
    }
  }

  formatNumber(num) {
    return new Intl.NumberFormat('pt-BR').format(num);
  }

  updateLanguageProgress(pt, en, tr) {
    const total = pt + en + tr;
    if (total > 0) {
      const ptPercent = (pt / total) * 100;
      const enPercent = (en / total) * 100;
      const trPercent = (tr / total) * 100;
      
      const ptProgress = document.getElementById('ptProgress');
      const enProgress = document.getElementById('enProgress');
      const trProgress = document.getElementById('trProgress');
      
      if (ptProgress) ptProgress.style.width = ptPercent + '%';
      if (enProgress) enProgress.style.width = enPercent + '%';
      if (trProgress) trProgress.style.width = trPercent + '%';
    }
  }

  async loadAllStats() {
    const container = document.querySelector('.stats-container');
    if (container) container.classList.add('loading');

    try {
      this.showMessage(`Carregando estatísticas via ${this.apis[this.currentAPI].name}...`);
      
      const results = await Promise.allSettled([
        this.get(this.counters.totalVisits),
        this.get(this.counters.todayVisits),
        this.get(this.counters.discordClicks),
        this.get(this.counters.langPt),
        this.get(this.counters.langEn),
        this.get(this.counters.langTr)
      ]);
      
      const [total, today, discord, pt, en, tr] = 
        results.map(result => result.status === 'fulfilled' ? result.value : 0);
      
      // Atualiza os elementos na página
      const elements = {
        'totalVisits': this.formatNumber(total),
        'todayVisits': this.formatNumber(today),
        'discordClicks': this.formatNumber(discord),
        'ptCount': this.formatNumber(pt),
        'enCount': this.formatNumber(en),
        'trCount': this.formatNumber(tr)
      };
      
      Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
      });
      
      this.updateLanguageProgress(pt, en, tr);
      
      const allOnline = results.every(result => result.status === 'fulfilled');
      ['totalStatus', 'todayStatus', 'discordStatus'].forEach(id => {
        this.setStatus(id, allOnline);
      });
      
      const lastUpdate = document.getElementById('lastUpdate');
      if (lastUpdate) lastUpdate.textContent = new Date().toLocaleString('pt-BR');
      
      const currentAPI = document.getElementById('currentAPI');
      if (currentAPI) currentAPI.textContent = this.apis[this.currentAPI].name;
      
      this.showMessage(`✅ Estatísticas carregadas via ${this.apis[this.currentAPI].name}!`);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      this.showMessage(`❌ Erro ao carregar via ${this.apis[this.currentAPI].name}`, true);
    } finally {
      if (container) container.classList.remove('loading');
    }
  }

  switchAPI(apiType) {
    this.currentAPI = apiType;
    document.querySelectorAll('.api-option').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`[data-api="${apiType}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    
    this.showMessage(`🔄 API alterada para ${this.apis[apiType].name}`);
    this.loadAllStats();
  }

  async trackVisit() {
    try {
      await this.increment(this.counters.totalVisits);
      await this.increment(this.counters.todayVisits);
      console.log('Visita rastreada com sucesso');
    } catch (error) {
      console.error('Erro ao rastrear visita:', error);
    }
  }

  async trackLanguageChange(lang) {
    try {
      if (lang === 'pt') await this.increment(this.counters.langPt);
      if (lang === 'en') await this.increment(this.counters.langEn);
      if (lang === 'tr') await this.increment(this.counters.langTr);
      if (lang === 'es') await this.increment(this.counters.langEs);
      console.log(`Mudança de idioma para ${lang} rastreada com sucesso`);
    } catch (error) {
      console.error('Erro ao rastrear mudança de idioma:', error);
    }
  }

  async trackDiscordClick() {
    try {
      await this.increment(this.counters.discordClicks);
      console.log('Clique no Discord rastreado com sucesso');
    } catch (error) {
      console.error('Erro ao rastrear clique no Discord:', error);
    }
  }
}

// Instância global
const statsTracker = new HaxballStatsTracker();

// Funções globais para os botões
window.loadAllStats = function() {
  statsTracker.loadAllStats();
};

window.switchAPI = function(apiType) {
  statsTracker.switchAPI(apiType);
};

// Carrega estatísticas quando a página abre
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM carregado, iniciando tracker...');
  setTimeout(async () => {
    await statsTracker.trackVisit();
    await statsTracker.loadAllStats();
    
    // Auto-refresh a cada 2 minutos
    setInterval(() => {
      statsTracker.loadAllStats();
    }, 2 * 60 * 1000);
  }, 1000);
});

// Exporta o tracker para uso global
window.statsTracker = statsTracker;
