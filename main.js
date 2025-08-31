// Configuração do Firebase a partir das variáveis de ambiente
const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_VISU_API_KEY,
  authDomain: import.meta.env.VITE_VISU_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_VISU_DATABASE_URL,
  projectId: import.meta.env.VITE_VISU_PROJECT_ID,
  storageBucket: import.meta.env.VITE_VISU_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_VISU_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_VISU_APP_ID
};

class HaxballStatsTracker {
  constructor() {
    this.currentAPI = 'firebase';
    this.firebaseInitialized = false;

    // Inicializa o Firebase somente se todas as chaves estiverem presentes
    try {
      if (Object.values(FIREBASE_CONFIG).every(key => key)) {
        if (!firebase.apps.length) {
          firebase.initializeApp(FIREBASE_CONFIG);
        }
        this.db = firebase.database();
        this.firebaseInitialized = true;
        console.log('Firebase inicializado com sucesso');
      } else {
        throw new Error('Configuração do Firebase incompleta.');
      }
    } catch (error) {
      console.error('Erro ao inicializar Firebase:', error);
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
      langEs: 'langEs' // Adicionado
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
    statusDiv.innerHTML = `
      <div class="${isError ? 'error-message' : 'success-message'}">
        ${message}
      </div>
    `;
    setTimeout(() => {
      statusDiv.innerHTML = '';
    }, 5000);
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
      document.getElementById('ptProgress').style.width = ptPercent + '%';
      document.getElementById('enProgress').style.width = enPercent + '%';
      document.getElementById('trProgress').style.width = trPercent + '%';
    }
  }

  async loadAllStats() {
    const container = document.querySelector('.stats-container');
    container.classList.add('loading');

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
      
      document.getElementById('totalVisits').textContent = this.formatNumber(total);
      document.getElementById('todayVisits').textContent = this.formatNumber(today);
      document.getElementById('discordClicks').textContent = this.formatNumber(discord);
      document.getElementById('ptCount').textContent = this.formatNumber(pt);
      document.getElementById('enCount').textContent = this.formatNumber(en);
      document.getElementById('trCount').textContent = this.formatNumber(tr);
      
      this.updateLanguageProgress(pt, en, tr);
      
      const allOnline = results.every(result => result.status === 'fulfilled');
      ['totalStatus', 'todayStatus', 'discordStatus'].forEach(id => {
        this.setStatus(id, allOnline);
      });
      document.getElementById('lastUpdate').textContent = new Date().toLocaleString('pt-BR');
      document.getElementById('currentAPI').textContent = this.apis[this.currentAPI].name;
      
      this.showMessage(`✅ Estatísticas carregadas via ${this.apis[this.currentAPI].name}!`);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      this.showMessage(`❌ Erro ao carregar via ${this.apis[this.currentAPI].name}`, true);
    } finally {
      container.classList.remove('loading');
    }
  }

  switchAPI(apiType) {
    this.currentAPI = apiType;
    document.querySelectorAll('.api-option').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-api="${apiType}"]`).classList.add('active');
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
function loadAllStats() {
  statsTracker.loadAllStats();
}

function switchAPI(apiType) {
  statsTracker.switchAPI(apiType);
}

// Carrega estatísticas quando a página abre
document.addEventListener('DOMContentLoaded', async () => {
  setTimeout(async () => {
    await statsTracker.trackVisit();
    await statsTracker.loadAllStats();
    
    // Auto-refresh a cada 2 minutos
    setInterval(() => {
      statsTracker.loadAllStats();
    }, 2 * 60 * 1000);
  }, 1000);
});
