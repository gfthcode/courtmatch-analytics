import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs:ClassValue[]) { return twMerge(clsx(inputs)); }
// shadcn/ui composition pattern, styled with CourtMatch's square sport controls.
const buttonVariants=cva('button',{variants:{variant:{default:'button-primary',secondary:'button-secondary',ghost:'button-ghost'},size:{default:'',small:'button-small'}},defaultVariants:{variant:'secondary',size:'default'}});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>,VariantProps<typeof buttonVariants>{asChild?:boolean}
export const Button=React.forwardRef<HTMLButtonElement,ButtonProps>(({className,variant,size,asChild=false,...props},ref)=>{const Comp=asChild?Slot:'button';return <Comp className={cn(buttonVariants({variant,size,className}))} ref={ref} {...props}/>;});
Button.displayName='Button';
