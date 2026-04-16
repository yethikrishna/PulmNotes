'use client';

import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { Note } from '@/app/types';
import dynamic from 'next/dynamic';

// ForceGraph2D requires document/window to exist, so dynamically load it without SSR
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface GraphViewProps {
  notes: Note[];
  onSelectNote: (noteId: string) => void;
}

export const GraphView: React.FC<GraphViewProps> = ({ notes, onSelectNote }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const graphRef = useRef<any>(null);

  // Resize observer to keep the canvas filling the screen
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.contentBoxSize) {
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
        }
      }
    });
    
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const graphData = useMemo(() => {
    const activeNotes = notes.filter(n => !n.isDeleted);
    
    const nodes = activeNotes.map(n => ({
      id: n.id,
      name: n.title || 'Untitled',
      val: 1 // Default size
    }));
    
    const links: { source: string, target: string }[] = [];
    const validNodeIds = new Set(nodes.map(n => n.id));
    
    // Extract edges based on mentions and wiki-links
    activeNotes.forEach(note => {
      const targetIds = new Set<string>();
      
      note.blocks.forEach(block => {
        // Check structural mentions array
        if (block.mentions) {
          block.mentions.forEach(m => targetIds.add(m.noteId));
        }
        
        // Fallback: check raw text for wiki-link pattern [[Title]]
        if (block.content) {
          activeNotes.forEach(potentialTarget => {
            if (
              potentialTarget.id !== note.id && 
              block.content!.includes(`[[${potentialTarget.title}]]`)
            ) {
              targetIds.add(potentialTarget.id);
            }
          });
        }

        // Check list items
        if (block.items) {
          block.items.forEach(item => {
            if (item.mentions) {
              item.mentions.forEach(m => targetIds.add(m.noteId));
            }
            if (item.content) {
              activeNotes.forEach(potentialTarget => {
                if (
                  potentialTarget.id !== note.id && 
                  item.content!.includes(`[[${potentialTarget.title}]]`)
                ) {
                  targetIds.add(potentialTarget.id);
                }
              });
            }
          });
        }
      });
      
      targetIds.forEach(targetId => {
        if (validNodeIds.has(targetId) && targetId !== note.id) {
          links.push({ source: note.id, target: targetId });
          
          // Bump size of target node to show importance
          const targetNode = nodes.find(n => n.id === targetId);
          if (targetNode) {
            targetNode.val += 0.5;
          }
        }
      });
    });
    
    return { nodes, links };
  }, [notes]);

  const handleNodeClick = useCallback((node: any) => {
    onSelectNote(node.id);
  }, [onSelectNote]);

  // Center graph on initial render
  useEffect(() => {
    if (graphRef.current) {
      setTimeout(() => {
        graphRef.current?.zoomToFit(400, 50);
      }, 500);
    }
  }, [graphData]);

  if (typeof window === 'undefined') return null;

  return (
    <div ref={containerRef} className="w-full h-full bg-[#DFEBF6] relative">
      <div className="absolute top-4 left-6 z-10 pointer-events-none">
        <h1 className="text-2xl font-bold text-stone-800">Knowledge Graph</h1>
        <p className="text-sm text-stone-500 mt-1">
          {graphData.nodes.length} notes, {graphData.links.length} connections
        </p>
      </div>
      
      <ForceGraph2D
        ref={graphRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeLabel="name"
        nodeColor={() => '#3b82f6'}
        linkColor={() => 'rgba(156, 163, 175, 0.4)'}
        nodeRelSize={4}
        linkWidth={1.5}
        onNodeClick={handleNodeClick}
        backgroundColor="#DFEBF6"
      />
    </div>
  );
};
