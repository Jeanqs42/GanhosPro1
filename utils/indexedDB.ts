import { RunRecord, AppSettings } from '../types';

const DB_NAME = 'GanhosProDB';
const DB_VERSION = 1;
const RECORDS_STORE = 'records';
const SETTINGS_STORE = 'settings';
const METADATA_STORE = 'metadata';

interface DBMetadata {
  lastSync: number;
  version: string;
  recordCount: number;
}

class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private isSupported: boolean = true;

  constructor() {
    this.isSupported = 'indexedDB' in window;
  }

  async init(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('IndexedDB não suportado, usando localStorage como fallback');
      return false;
    }

    try {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
          console.error('Erro ao abrir IndexedDB:', request.error);
          this.isSupported = false;
          resolve(false);
        };

        request.onsuccess = () => {
          this.db = request.result;
          resolve(true);
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // Store para registros de corridas
          if (!db.objectStoreNames.contains(RECORDS_STORE)) {
            const recordsStore = db.createObjectStore(RECORDS_STORE, { keyPath: 'id' });
            recordsStore.createIndex('date', 'date', { unique: false });
            recordsStore.createIndex('netProfit', 'netProfit', { unique: false });
          }

          // Store para configurações
          if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
            db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
          }

          // Store para metadados
          if (!db.objectStoreNames.contains(METADATA_STORE)) {
            db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
          }
        };
      });
    } catch (error) {
      console.error('Erro ao inicializar IndexedDB:', error);
      this.isSupported = false;
      return false;
    }
  }

  // Operações para registros
  async saveRecord(record: RunRecord): Promise<boolean> {
    if (!this.isSupported || !this.db) {
      return this.fallbackSaveRecord(record);
    }

    try {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([RECORDS_STORE], 'readwrite');
        const store = transaction.objectStore(RECORDS_STORE);
        const request = store.put(record);

        request.onsuccess = () => {
          this.updateMetadata();
          resolve(true);
        };

        request.onerror = () => {
          console.error('Erro ao salvar registro:', request.error);
          resolve(false);
        };
      });
    } catch (error) {
      console.error('Erro ao salvar registro:', error);
      return this.fallbackSaveRecord(record);
    }
  }

  async getAllRecords(): Promise<RunRecord[]> {
    if (!this.isSupported || !this.db) {
      return this.fallbackGetAllRecords();
    }

    try {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([RECORDS_STORE], 'readonly');
        const store = transaction.objectStore(RECORDS_STORE);
        const request = store.getAll();

        request.onsuccess = () => {
          resolve(request.result || []);
        };

        request.onerror = () => {
          console.error('Erro ao buscar registros:', request.error);
          resolve(this.fallbackGetAllRecords());
        };
      });
    } catch (error) {
      console.error('Erro ao buscar registros:', error);
      return this.fallbackGetAllRecords();
    }
  }

  async deleteRecord(id: string): Promise<boolean> {
    if (!this.isSupported || !this.db) {
      return this.fallbackDeleteRecord(id);
    }

    try {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([RECORDS_STORE], 'readwrite');
        const store = transaction.objectStore(RECORDS_STORE);
        const request = store.delete(id);

        request.onsuccess = () => {
          this.updateMetadata();
          resolve(true);
        };

        request.onerror = () => {
          console.error('Erro ao deletar registro:', request.error);
          resolve(false);
        };
      });
    } catch (error) {
      console.error('Erro ao deletar registro:', error);
      return this.fallbackDeleteRecord(id);
    }
  }

  // Operações para configurações
  async saveSettings(settings: AppSettings): Promise<boolean> {
    if (!this.isSupported || !this.db) {
      return this.fallbackSaveSettings(settings);
    }

    try {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([SETTINGS_STORE], 'readwrite');
        const store = transaction.objectStore(SETTINGS_STORE);
        const request = store.put({ key: 'app_settings', ...settings });

        request.onsuccess = () => resolve(true);
        request.onerror = () => {
          console.error('Erro ao salvar configurações:', request.error);
          resolve(false);
        };
      });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      return this.fallbackSaveSettings(settings);
    }
  }

  async getSettings(): Promise<AppSettings> {
    if (!this.isSupported || !this.db) {
      return this.fallbackGetSettings();
    }

    try {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([SETTINGS_STORE], 'readonly');
        const store = transaction.objectStore(SETTINGS_STORE);
        const request = store.get('app_settings');

        request.onsuccess = () => {
          const result = request.result;
          if (result) {
            const { key, ...settings } = result;
            resolve(settings as AppSettings);
          } else {
            resolve({ costPerKm: 0.75 });
          }
        };

        request.onerror = () => {
          console.error('Erro ao buscar configurações:', request.error);
          resolve(this.fallbackGetSettings());
        };
      });
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      return this.fallbackGetSettings();
    }
  }

  // Metadados e sincronização
  private async updateMetadata(): Promise<void> {
    if (!this.isSupported || !this.db) return;

    try {
      const recordCount = await this.getRecordCount();
      const metadata: DBMetadata = {
        lastSync: Date.now(),
        version: '1.0.0',
        recordCount
      };

      const transaction = this.db.transaction([METADATA_STORE], 'readwrite');
      const store = transaction.objectStore(METADATA_STORE);
      store.put({ key: 'app_metadata', ...metadata });
    } catch (error) {
      console.error('Erro ao atualizar metadados:', error);
    }
  }

  private async getRecordCount(): Promise<number> {
    if (!this.isSupported || !this.db) return 0;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([RECORDS_STORE], 'readonly');
      const store = transaction.objectStore(RECORDS_STORE);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    });
  }

  // Fallbacks para localStorage
  private fallbackSaveRecord(record: RunRecord): boolean {
    try {
      const records = this.fallbackGetAllRecords();
      const existingIndex = records.findIndex(r => r.id === record.id);
      
      if (existingIndex > -1) {
        records[existingIndex] = record;
      } else {
        records.push(record);
      }
      
      localStorage.setItem('ganhospro_records', JSON.stringify(records));
      return true;
    } catch (error) {
      console.error('Erro no fallback de salvar registro:', error);
      return false;
    }
  }

  private fallbackGetAllRecords(): RunRecord[] {
    try {
      const stored = localStorage.getItem('ganhospro_records');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Erro no fallback de buscar registros:', error);
      return [];
    }
  }

  private fallbackDeleteRecord(id: string): boolean {
    try {
      const records = this.fallbackGetAllRecords();
      const filtered = records.filter(r => r.id !== id);
      localStorage.setItem('ganhospro_records', JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Erro no fallback de deletar registro:', error);
      return false;
    }
  }

  private fallbackSaveSettings(settings: AppSettings): boolean {
    try {
      localStorage.setItem('ganhospro_settings', JSON.stringify(settings));
      return true;
    } catch (error) {
      console.error('Erro no fallback de salvar configurações:', error);
      return false;
    }
  }

  private fallbackGetSettings(): AppSettings {
    try {
      const stored = localStorage.getItem('ganhospro_settings');
      return stored ? JSON.parse(stored) : { costPerKm: 0.75 };
    } catch (error) {
      console.error('Erro no fallback de buscar configurações:', error);
      return { costPerKm: 0.75 };
    }
  }

  // Utilitários
  async clearAllData(): Promise<boolean> {
    if (!this.isSupported || !this.db) {
      localStorage.removeItem('ganhospro_records');
      localStorage.removeItem('ganhospro_settings');
      return true;
    }

    try {
      return new Promise((resolve) => {
        const transaction = this.db!.transaction([RECORDS_STORE, SETTINGS_STORE, METADATA_STORE], 'readwrite');
        
        transaction.objectStore(RECORDS_STORE).clear();
        transaction.objectStore(SETTINGS_STORE).clear();
        transaction.objectStore(METADATA_STORE).clear();

        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => resolve(false);
      });
    } catch (error) {
      console.error('Erro ao limpar dados:', error);
      return false;
    }
  }

  async getStorageInfo(): Promise<{ supported: boolean; recordCount: number; lastSync?: number }> {
    const recordCount = (await this.getAllRecords()).length;
    
    if (!this.isSupported || !this.db) {
      return { supported: false, recordCount };
    }

    try {
      return new Promise((resolve) => {
        const transaction = this.db!.transaction([METADATA_STORE], 'readonly');
        const store = transaction.objectStore(METADATA_STORE);
        const request = store.get('app_metadata');

        request.onsuccess = () => {
          const metadata = request.result;
          resolve({
            supported: true,
            recordCount,
            lastSync: metadata?.lastSync
          });
        };

        request.onerror = () => {
          resolve({ supported: true, recordCount });
        };
      });
    } catch (error) {
      return { supported: true, recordCount };
    }
  }
}

// Singleton instance
export const dbManager = new IndexedDBManager();

// Hook personalizado para usar o IndexedDB
export const useIndexedDB = () => {
  return {
    saveRecord: (record: RunRecord) => dbManager.saveRecord(record),
    getAllRecords: () => dbManager.getAllRecords(),
    deleteRecord: (id: string) => dbManager.deleteRecord(id),
    saveSettings: (settings: AppSettings) => dbManager.saveSettings(settings),
    getSettings: () => dbManager.getSettings(),
    clearAllData: () => dbManager.clearAllData(),
    getStorageInfo: () => dbManager.getStorageInfo(),
  };
};