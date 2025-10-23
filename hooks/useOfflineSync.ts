import { useState, useEffect, useCallback, useRef } from 'react';
import { dbManager } from '../utils/indexedDB';
import { RunRecord, AppSettings } from '../types';

interface OfflineOperation {
  id: string;
  type: 'save' | 'delete' | 'update';
  data: RunRecord | { id: string };
  timestamp: number;
  retryCount: number;
}

interface OfflineSyncState {
  isOnline: boolean;
  isInitialized: boolean;
  pendingOperations: OfflineOperation[];
  lastSyncTime: number | null;
  syncInProgress: boolean;
}

const MAX_RETRY_COUNT = 3;
const SYNC_RETRY_DELAY = 5000; // 5 segundos
const MAX_RETRY_DELAY = 60000; // 60 segundos

// Dedupar operações por recurso (id do registro) mantendo a mais recente
const dedupeOperations = (operations: OfflineOperation[]): OfflineOperation[] => {
  const map = new Map<string, OfflineOperation>();
  for (const op of operations) {
    const resourceId = op.type === 'delete' 
      ? (op.data as { id: string }).id 
      : (op.data as RunRecord).id;
    const existing = map.get(resourceId);
    if (!existing || existing.timestamp <= op.timestamp) {
      // Regra de precedência: delete vence sobre save/update se for mais recente
      map.set(resourceId, op);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
};

export const useOfflineSync = () => {
  const [state, setState] = useState<OfflineSyncState>({
    isOnline: navigator.onLine,
    isInitialized: false,
    pendingOperations: [],
    lastSyncTime: null,
    syncInProgress: false,
  });

  const syncTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const initPromiseRef = useRef<Promise<void> | undefined>(undefined);

  // Inicialização do IndexedDB
  const initializeDB = useCallback(async () => {
    if (initPromiseRef.current) {
      return initPromiseRef.current;
    }

    initPromiseRef.current = (async () => {
      try {
        const success = await dbManager.init();
        
        // Carregar operações pendentes do localStorage
        const pendingOps = loadPendingOperations();
        
        setState(prev => ({
          ...prev,
          isInitialized: true,
          pendingOperations: pendingOps,
        }));

        // Se estiver online, tentar sincronizar operações pendentes
        if (navigator.onLine && pendingOps.length > 0) {
          processPendingOperations(pendingOps);
        }
      } catch (error) {
        console.error('Erro ao inicializar sincronização offline:', error);
        setState(prev => ({ ...prev, isInitialized: true }));
      }
    })();

    return initPromiseRef.current;
  }, []);

  // Detectar mudanças na conectividade
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => {
        const newState = { ...prev, isOnline: true };
        
        // Processar operações pendentes quando voltar online
        if (prev.pendingOperations.length > 0) {
          processPendingOperations(prev.pendingOperations);
        }
        
        return newState;
      });
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [state.pendingOperations]);

  // Inicializar quando o componente montar
  useEffect(() => {
    initializeDB();
  }, [initializeDB]);

  // Salvar operações pendentes no localStorage
  const savePendingOperations = useCallback((operations: OfflineOperation[]) => {
    try {
      const clean = dedupeOperations(operations);
      localStorage.setItem('ganhospro_pending_ops', JSON.stringify(clean));
    } catch (error) {
      console.error('Erro ao salvar operações pendentes:', error);
    }
  }, []);

  // Carregar operações pendentes do localStorage
  const loadPendingOperations = useCallback((): OfflineOperation[] => {
    try {
      const stored = localStorage.getItem('ganhospro_pending_ops');
      const ops = stored ? JSON.parse(stored) : [];
      return dedupeOperations(ops);
    } catch (error) {
      console.error('Erro ao carregar operações pendentes:', error);
      return [];
    }
  }, []);

  // Adicionar operação à fila de pendentes
  const addPendingOperation = useCallback((operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount'>) => {
    const newOperation: OfflineOperation = {
      ...operation,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };

    setState(prev => {
      const newPendingOps = dedupeOperations([...prev.pendingOperations, newOperation]);
      savePendingOperations(newPendingOps);
      return {
        ...prev,
        pendingOperations: newPendingOps,
      };
    });

    // Se estiver online, tentar processar imediatamente
    if (state.isOnline) {
      processPendingOperations([newOperation]);
    }
  }, [state.isOnline, savePendingOperations]);

  // Processar operações pendentes
  const processPendingOperations = useCallback(async (operations: OfflineOperation[]) => {
    if (state.syncInProgress || !state.isOnline) return;

    setState(prev => ({ ...prev, syncInProgress: true }));

    const ops = dedupeOperations(operations);
    const successfulOps: string[] = [];
    const failedOps: OfflineOperation[] = [];

    for (const operation of ops) {
      try {
        let success = false;

        switch (operation.type) {
          case 'save':
          case 'update':
            success = await dbManager.saveRecord(operation.data as RunRecord);
            break;
          case 'delete':
            success = await dbManager.deleteRecord((operation.data as { id: string }).id);
            break;
        }

        if (success) {
          successfulOps.push(operation.id);
        } else {
          throw new Error(`Falha na operação ${operation.type}`);
        }
      } catch (error) {
        console.error(`Erro ao processar operação ${operation.type}:`, error);
        
        if (operation.retryCount < MAX_RETRY_COUNT) {
          failedOps.push({
            ...operation,
            retryCount: operation.retryCount + 1,
            timestamp: Date.now(),
          });
        }
      }
    }

    // Atualizar estado removendo operações bem-sucedidas
    setState(prev => {
      const remainingOps = dedupeOperations(prev.pendingOperations.filter(op => 
        !successfulOps.includes(op.id)
      ).concat(failedOps));

      savePendingOperations(remainingOps);

      return {
        ...prev,
        pendingOperations: remainingOps,
        syncInProgress: false,
        lastSyncTime: successfulOps.length > 0 ? Date.now() : prev.lastSyncTime,
      };
    });

    // Reagendar tentativas para operações falhadas com backoff exponencial
    if (failedOps.length > 0) {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      const maxRetry = Math.max(...failedOps.map(op => op.retryCount));
      const nextDelay = Math.min(SYNC_RETRY_DELAY * Math.pow(2, maxRetry), MAX_RETRY_DELAY);

      syncTimeoutRef.current = setTimeout(() => {
        processPendingOperations(failedOps);
      }, nextDelay);
    }
  }, [state.syncInProgress, state.isOnline, savePendingOperations]);

  // Operações de dados com suporte offline
  const saveRecord = useCallback(async (record: RunRecord): Promise<boolean> => {
    if (!state.isInitialized) {
      await initializeDB();
    }

    if (state.isOnline) {
      try {
        const success = await dbManager.saveRecord(record);
        if (success) {
          return true;
        }
      } catch (error) {
        console.error('Erro ao salvar registro online:', error);
      }
    }

    // Se offline ou falha online, adicionar à fila
    addPendingOperation({
      type: 'save',
      data: record,
    });

    // Salvar localmente para acesso imediato
    return await dbManager.saveRecord(record);
  }, [state.isInitialized, state.isOnline, initializeDB, addPendingOperation]);

  const deleteRecord = useCallback(async (id: string): Promise<boolean> => {
    if (!state.isInitialized) {
      await initializeDB();
    }

    if (state.isOnline) {
      try {
        const success = await dbManager.deleteRecord(id);
        if (success) {
          return true;
        }
      } catch (error) {
        console.error('Erro ao deletar registro online:', error);
      }
    }

    // Se offline ou falha online, adicionar à fila
    addPendingOperation({
      type: 'delete',
      data: { id },
    });

    // Deletar localmente para acesso imediato
    return await dbManager.deleteRecord(id);
  }, [state.isInitialized, state.isOnline, initializeDB, addPendingOperation]);

  const getAllRecords = useCallback(async (): Promise<RunRecord[]> => {
    if (!state.isInitialized) {
      await initializeDB();
    }

    return await dbManager.getAllRecords();
  }, [state.isInitialized, initializeDB]);

  const saveSettings = useCallback(async (settings: AppSettings): Promise<boolean> => {
    if (!state.isInitialized) {
      await initializeDB();
    }

    return await dbManager.saveSettings(settings);
  }, [state.isInitialized, initializeDB]);

  const getSettings = useCallback(async (): Promise<AppSettings> => {
    if (!state.isInitialized) {
      await initializeDB();
    }

    return await dbManager.getSettings();
  }, [state.isInitialized, initializeDB]);

  // Forçar sincronização manual
  const forcSync = useCallback(() => {
    if (state.isOnline && state.pendingOperations.length > 0) {
      processPendingOperations(state.pendingOperations);
    }
  }, [state.isOnline, state.pendingOperations, processPendingOperations]);

  // Limpar operações pendentes
  const clearPendingOperations = useCallback(() => {
    setState(prev => ({ ...prev, pendingOperations: [] }));
    localStorage.removeItem('ganhospro_pending_ops');
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Estado
    isOnline: state.isOnline,
    isInitialized: state.isInitialized,
    pendingOperations: state.pendingOperations,
    lastSyncTime: state.lastSyncTime,
    syncInProgress: state.syncInProgress,
    hasPendingOperations: state.pendingOperations.length > 0,

    // Operações de dados
    saveRecord,
    deleteRecord,
    getAllRecords,
    saveSettings,
    getSettings,

    // Controle de sincronização
    forcSync,
    clearPendingOperations,
    
    // Utilitários
    getStorageInfo: () => dbManager.getStorageInfo(),
  };
};