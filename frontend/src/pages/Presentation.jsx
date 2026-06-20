import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import { Play, CheckCircle, Clock, AlertCircle, ArrowRight, Server, ShoppingCart, Settings, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Presentation() {
  const toast = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState([]);
  const [products, setProducts] = useState([]);
  const [results, setResults] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data } = await api.get('/products');
      setProducts(data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const addStep = (message, type = 'info', delay = 0) => {
    return new Promise(resolve => {
      setTimeout(() => {
        setSteps(prev => [...prev, { id: Date.now(), message, type }]);
        resolve();
      }, delay);
    });
  };

  const runScenario = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setSteps([]);
    setResults(null);

    try {
      // Find an MTO product or any finished product
      let targetProduct = products.find(p => p.procurementType === 'MTO' && p.productType === 'finished');
      if (!targetProduct) {
        targetProduct = products.find(p => p.productType === 'finished');
      }

      if (!targetProduct) {
        await addStep('Error: No finished products found in database.', 'error');
        setIsRunning(false);
        return;
      }

      const orderQty = 25; // Large quantity to ensure shortage

      await addStep(`Starting Business Scenario: Make-to-Order Pipeline`, 'title', 500);
      await addStep(`Customer "Enterprise Corp" requests ${orderQty} units of ${targetProduct.name}`, 'info', 1500);

      // Step 1: Create Draft SO
      await addStep(`[System] Creating Draft Sales Order...`, 'loading', 1000);
      const soPayload = {
        customer: 'Enterprise Corp',
        customerEmail: 'ceo@enterprise.com',
        customerPhone: '+1-555-0199',
        notes: 'URGENT: Hackathon Demo Scenario',
        items: [{ productId: targetProduct.id, qty: orderQty, unitPrice: targetProduct.salesPrice || 5000 }]
      };
      const { data: soRes } = await api.post('/sales', soPayload);
      const so = soRes.data;
      await addStep(`✅ Sales Order ${so.orderNo} created successfully in Draft state.`, 'success', 800);

      // Step 2: Stock Check
      await addStep(`[System] Checking inventory for ${targetProduct.name}...`, 'loading', 1200);
      const onHand = targetProduct.onHandQty || 0;
      if (onHand < orderQty) {
        await addStep(`⚠ Shortage Detected! Only ${onHand} in stock. Need ${orderQty}.`, 'warning', 1000);
      } else {
        await addStep(`ℹ Sufficient stock found, but let's assume a shortage for the demo...`, 'warning', 1000);
      }

      // Step 3: Confirm SO -> Trigger Procurements
      await addStep(`[Action] Sales Team confirms the order.`, 'info', 1500);
      await addStep(`[System] Processing order confirmation & triggering automation...`, 'loading', 1500);
      
      const { data: confirmRes } = await api.post(`/sales/${so.id}/confirm`);
      const confirmedSo = confirmRes.data;
      const actions = confirmRes.procurementActions || [];

      await addStep(`✅ Sales Order ${confirmedSo.orderNo} is now Confirmed.`, 'success', 800);

      // Analyze procurement actions
      const createdMOs = actions.filter(a => a.type === 'ManufacturingOrder' && a.action === 'created');
      const createdPOs = actions.filter(a => a.type === 'PurchaseOrder' && a.action === 'created');

      if (createdMOs.length > 0) {
        for (const mo of createdMOs) {
          await addStep(`⚙️ [Automation] Make-To-Order route triggered. Manufacturing Order created.`, 'info', 1000);
          await addStep(`✅ MO Generated for ${mo.message}`, 'success', 800);
        }
      }

      if (createdPOs.length > 0) {
        await addStep(`[System] Checking raw material availability for production...`, 'loading', 1200);
        await addStep(`⚠ Raw Material Shortage Detected for Bills of Material components!`, 'warning', 1000);
        for (const po of createdPOs) {
          await addStep(`🛒 [Automation] Minimum Stock Rule triggered. Auto-drafting Purchase Orders.`, 'info', 1000);
          await addStep(`✅ PO Generated: ${po.message}`, 'success', 800);
        }
      }

      await addStep(`🎉 Business Scenario Complete! The complete supply chain cascade was handled automatically.`, 'title', 1500);
      
      setResults({
        salesOrderId: confirmedSo.id,
        orderNo: confirmedSo.orderNo
      });

      toast.success('Scenario ran successfully!');

    } catch (err) {
      console.error(err);
      await addStep(`❌ Error: ${err.response?.data?.message || err.message}`, 'error');
      toast.error('Scenario failed');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Presentation Mode</h1>
          <p className="text-gray-400 mt-1">One-click live demonstration of the ERP Automation Cascade.</p>
        </div>
      </div>

      <div className="bg-dark-card border border-dark-border rounded-xl p-8 mb-8 text-center shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent opacity-50 pointer-events-none"></div>
        <div className="relative z-10">
          <div className="flex justify-center space-x-8 mb-8 text-gray-500">
            <div className="flex flex-col items-center"><ShoppingCart className="w-8 h-8 mb-2" /><span>Sales</span></div>
            <ArrowRight className="w-6 h-6 self-center text-primary/50" />
            <div className="flex flex-col items-center"><Settings className="w-8 h-8 mb-2" /><span>Manufacturing</span></div>
            <ArrowRight className="w-6 h-6 self-center text-primary/50" />
            <div className="flex flex-col items-center"><Server className="w-8 h-8 mb-2" /><span>Procurement</span></div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-4">Run the "Make-To-Order" Automation</h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            This will simulate a customer placing a massive order, which will detect stock shortages, automatically generate manufacturing orders, and draft purchase orders for missing raw materials in real-time.
          </p>

          <button
            onClick={runScenario}
            disabled={isRunning || products.length === 0}
            className={`px-8 py-4 rounded-xl font-bold text-lg inline-flex items-center space-x-3 transition-all transform ${
              isRunning 
                ? 'bg-primary/50 cursor-not-allowed scale-95' 
                : 'bg-primary hover:bg-primary-hover hover:scale-105 hover:shadow-[0_0_20px_rgba(13,138,188,0.4)] text-white'
            }`}
          >
            {isRunning ? (
              <><Clock className="w-6 h-6 animate-spin" /> <span>Running Simulation...</span></>
            ) : (
              <><Play className="w-6 h-6" fill="currentColor" /> <span>Run Business Scenario</span></>
            )}
          </button>
        </div>
      </div>

      {steps.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Server className="w-5 h-5 mr-2 text-primary" /> System Execution Log
          </h3>
          <div className="space-y-4 font-mono text-sm">
            {steps.map((step) => (
              <div 
                key={step.id} 
                className={`p-3 rounded-lg border flex items-start animate-fade-in ${
                  step.type === 'title' ? 'bg-primary/20 border-primary/50 text-primary font-bold text-base' :
                  step.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                  step.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
                  step.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                  step.type === 'loading' ? 'bg-blue-500/5 border-blue-500/20 text-blue-300' :
                  'bg-gray-800/50 border-gray-700 text-gray-300'
                }`}
              >
                {step.type === 'success' && <CheckCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />}
                {step.type === 'warning' && <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />}
                {step.type === 'error' && <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />}
                {step.type === 'loading' && <Clock className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 animate-spin" />}
                {step.type === 'info' && <ArrowRight className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-gray-500" />}
                {step.type === 'title' && <Play className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />}
                <span className="break-words">{step.message}</span>
              </div>
            ))}
          </div>

          {results && (
            <div className="mt-8 pt-6 border-t border-dark-border flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Scenario completed successfully.</p>
                <p className="text-sm text-gray-400">You can now explore the generated records.</p>
              </div>
              <Link
                to="/sales"
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors border border-gray-700 inline-flex items-center"
              >
                View Sales Orders <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
