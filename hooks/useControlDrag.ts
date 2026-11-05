
import { useState, useRef, useEffect, useCallback } from 'react';

interface UseControlDragProps {
    value: number;
    min: number;
    max: number;
    onChange: (val: number) => void;
    sensitivity?: number; // Pixels to traverse full range (default 200)
    direction?: 'vertical' | 'horizontal';
    logarithmic?: boolean;
}

export const useControlDrag = ({
    value, min, max, onChange,
    sensitivity = 200,
    direction = 'vertical',
    logarithmic = false
}: UseControlDragProps) => {
    const [isDragging, setIsDragging] = useState(false);
    const startPos = useRef(0);
    const startVal = useRef(0);

    // Normalize value 0..1
    const toNormal = useCallback((v: number) => {
        const safeV = Math.max(min, Math.min(max, v));
        if (logarithmic) {
            const minLog = Math.log(min === 0 ? 0.001 : min);
            const maxLog = Math.log(max);
            return (Math.log(safeV) - minLog) / (maxLog - minLog);
        }
        return (safeV - min) / (max - min);
    }, [min, max, logarithmic]);

    // Denormalize 0..1 to value
    const fromNormal = useCallback((n: number) => {
        const clamped = Math.max(0, Math.min(1, n));
        if (logarithmic) {
            const minLog = Math.log(min === 0 ? 0.001 : min);
            const maxLog = Math.log(max);
            return Math.exp(minLog + (maxLog - minLog) * clamped);
        }
        return min + clamped * (max - min);
    }, [min, max, logarithmic]);

    const [internalNormal, setInternalNormal] = useState(toNormal(value));

    // Sync external changes when not dragging
    useEffect(() => {
        if (!isDragging) {
            setInternalNormal(toNormal(value));
        }
    }, [value, toNormal, isDragging]);

    const handleStart = (clientPos: number) => {
        setIsDragging(true);
        startPos.current = clientPos;
        startVal.current = internalNormal;
        document.body.style.cursor = direction === 'vertical' ? 'ns-resize' : 'ew-resize';
        document.body.style.userSelect = 'none';
    };

    const handleMove = useCallback((clientPos: number, isFine: boolean) => {
        if (!isDragging) return;

        const deltaPixels = startPos.current - clientPos; // Up/Left drag increases value typically
        
        // Direction correction: Up (lower Y) is positive. Right (higher X) is positive.
        // If vertical: startY - currentY (positive delta = moving up)
        // If horizontal: currentX - startX (positive delta = moving right)
        const adjustedDelta = direction === 'vertical' ? deltaPixels : (clientPos - startPos.current);
        
        const effectiveSensitivity = isFine ? sensitivity * 5 : sensitivity;
        const deltaNormal = adjustedDelta / effectiveSensitivity;

        const newNormal = Math.max(0, Math.min(1, startVal.current + deltaNormal));
        
        setInternalNormal(newNormal);
        onChange(fromNormal(newNormal));
    }, [isDragging, sensitivity, direction, fromNormal, onChange]);

    const handleEnd = useCallback(() => {
        setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, []);

    useEffect(() => {
        if (isDragging) {
            const onMouseMove = (e: MouseEvent) => {
                e.preventDefault();
                const pos = direction === 'vertical' ? e.clientY : e.clientX;
                handleMove(pos, e.shiftKey || e.ctrlKey);
            };
            const onTouchMove = (e: TouchEvent) => {
                e.preventDefault(); 
                const pos = direction === 'vertical' ? e.touches[0].clientY : e.touches[0].clientX;
                handleMove(pos, false); // No modifier keys on touch usually
            };
            const onUp = () => handleEnd();

            window.addEventListener('mousemove', onMouseMove, { passive: false });
            window.addEventListener('touchmove', onTouchMove, { passive: false });
            window.addEventListener('mouseup', onUp);
            window.addEventListener('touchend', onUp);

            return () => {
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('touchmove', onTouchMove);
                window.removeEventListener('mouseup', onUp);
                window.removeEventListener('touchend', onUp);
            };
        }
    }, [isDragging, handleMove, handleEnd, direction]);

    return {
        isDragging,
        handleStart,
        percentage: internalNormal
    };
};
