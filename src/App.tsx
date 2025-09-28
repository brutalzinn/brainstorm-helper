import React from 'react';
import { Container } from 'react-bootstrap';
import { ChatInterface } from './components/ChatInterface';
import { useBrainstormQueue } from './hooks/useBrainstormQueue';
import './App.css';

function App() {
  // Set dark theme on the document immediately
  React.useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', 'dark');
    document.body.style.backgroundColor = '#1a1a1a';
    document.body.style.color = '#ffffff';
    console.log('Dark theme applied');
  }, []);

  const { 
    messages, 
    stats, 
    isProcessing, 
    currentProvider,
    availableProviders,
    context,
    markdownSummary,
    autoProcess,
    addMessage, 
    generateBrainstorm,
    switchProvider,
    updateApiKey,
    removeMessage,
    moveMessageUp,
    toggleAutoProcess,
    processQueue
  } = useBrainstormQueue();

  return (
    <Container fluid className="p-0 h-100 bg-dark">
      <ChatInterface
        messages={messages}
        stats={stats}
        isProcessing={isProcessing}
        currentProvider={currentProvider}
        availableProviders={availableProviders}
        context={context}
        markdownSummary={markdownSummary}
        onSendMessage={addMessage}
        onGenerateBrainstorm={generateBrainstorm}
        onSwitchProvider={switchProvider}
        onUpdateApiKey={updateApiKey}
        removeMessage={removeMessage}
        moveMessageUp={moveMessageUp}
        autoProcess={autoProcess}
        onToggleAutoProcess={toggleAutoProcess}
        onProcessQueue={processQueue}
      />
    </Container>
  );
}

export default App;