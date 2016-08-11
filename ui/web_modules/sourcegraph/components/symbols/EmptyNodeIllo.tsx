// tslint:disable: typedef ordered-imports

import * as React from "react";

interface Props {
	className?: string;
	width?: number; // appended by "px"
}

export class EmptyNodeIllo extends React.Component<Props, any> {
	static defaultProps = {
		width: 500,
	};

	render(): JSX.Element | null {
		return (<svg xmlns="http://www.w3.org/2000/svg" width={this.props.width} className={this.props.className} viewBox="0 0 530 314" style={{maxWidth: "100%"}}><g fill="none" fill-rule="evenodd" transform="rotate(-7 141.026 183.85)"><path fill="#76D0F2" fillOpacity=".101" d="M68.116 44.816l67.942 135.765H.175"/><path fill="#76D0F2" fillOpacity=".101" d="M136.023 148.69l12.887 165.65-89.447-48.605M289.75 126.64l163.336 30.425L329.89 57.608"/><path fill="#76D0F2" fillOpacity=".101" d="M472.184 70.61l12.886 165.645-136.507-43.178"/><path fill="#76D0F2" fillOpacity=".101" d="M397.496 203.128l11.235 144.266-98.84-89.908"/><path stroke="#D5E5F2" strokeWidth="3.5" d="M311.42 244.395l48.977 19.25m69.72-12.478l106.656-105.744M79.08 146.75l88.56-19.116m-122.928 67.62l75.407 57.91M139.28.984l43.14 104.086M416.8 75.505l-36.248 49.916m-98.1-68.29l78.017 75.91m-49.5 48.38l44.36-32.84m-122.09 26.2l-28.31-32.36m15.67 90.48l-46.95 19.37" strokeLinecap="round" strokeDasharray=".7 11.2"/><circle cx="268.376" cy="212.535" r="39.5" fill="#FFF"/><path fill="#0092D6" d="M268.118 254.264c2.958 0 5.876-.31 8.72-.923.946-.2 1.548-1.13 1.344-2.07-.203-.94-1.134-1.54-2.08-1.34-2.602.56-5.274.85-7.984.85-.967 0-1.75.79-1.75 1.75 0 .97.783 1.75 1.75 1.75zm19.038-4.643c2.6-1.35 5.05-2.98 7.305-4.85.75-.61.85-1.72.23-2.46s-1.72-.84-2.46-.23c-2.06 1.72-4.3 3.21-6.68 4.45-.85.45-1.19 1.51-.74 2.36.45.86 1.51 1.19 2.36.75zm14.74-12.9c1.686-2.4 3.112-4.97 4.252-7.67.376-.89-.042-1.91-.932-2.29-.89-.37-1.917.04-2.293.94-1.043 2.47-2.348 4.83-3.89 7.02-.556.79-.366 1.88.425 2.44.79.56 1.882.37 2.438-.42zm7.112-18.19c.238-1.79.36-3.61.36-5.44 0-1.12-.044-2.23-.13-3.32-.078-.96-.92-1.68-1.884-1.6-.964.08-1.683.92-1.606 1.89.08 1.01.12 2.02.12 3.05 0 1.68-.11 3.34-.33 4.99-.127.96.547 1.84 1.505 1.96.958.13 1.838-.54 1.965-1.5zm-2.087-19.48c-.99-2.76-2.29-5.4-3.85-7.88-.51-.82-1.59-1.06-2.41-.55-.82.52-1.06 1.6-.55 2.42 1.43 2.27 2.61 4.69 3.53 7.21.33.91 1.34 1.38 2.24 1.05.91-.33 1.38-1.33 1.05-2.24zm-10.85-16.3c-2.15-1.98-4.52-3.74-7.04-5.22-.83-.49-1.9-.21-2.39.62s-.21 1.91.62 2.4c2.32 1.36 4.48 2.97 6.45 4.78.71.66 1.82.61 2.48-.1s.61-1.82-.1-2.47zm-17.11-9.46c-2.81-.76-5.71-1.23-8.66-1.38-.96-.05-1.79.69-1.84 1.66-.05.97.69 1.79 1.66 1.84 2.7.14 5.36.57 7.93 1.26.94.26 1.9-.29 2.15-1.23s-.3-1.89-1.23-2.14zm-19.6-.5c-2.87.62-5.66 1.55-8.33 2.76-.88.4-1.26 1.44-.86 2.32.4.88 1.44 1.27 2.32.87 2.44-1.11 4.99-1.96 7.62-2.53.95-.2 1.55-1.14 1.34-2.08-.2-.94-1.13-1.55-2.08-1.34zm-17.59 8.58c-2.25 1.87-4.3 3.98-6.11 6.29-.59.76-.46 1.86.3 2.46.76.6 1.86.47 2.46-.29 1.66-2.11 3.54-4.04 5.6-5.75.75-.62.85-1.72.23-2.462-.62-.74-1.72-.84-2.46-.224zm-11.71 15.81c-1.13 2.7-1.97 5.52-2.5 8.41-.17.95.46 1.87 1.41 2.04.95.18 1.87-.45 2.04-1.4.49-2.65 1.26-5.22 2.29-7.69.37-.89-.05-1.91-.94-2.29-.89-.37-1.92.05-2.29.94zm-3.04 19.24c.24 2.94.79 5.83 1.64 8.62.28.93 1.25 1.45 2.18 1.17.92-.28 1.45-1.25 1.17-2.18-.77-2.55-1.27-5.19-1.49-7.88-.07-.96-.92-1.68-1.88-1.6-.96.08-1.68.92-1.6 1.89zm6.21 18.62c1.57 2.48 3.39 4.78 5.45 6.88.68.69 1.79.7 2.48.03.69-.68.7-1.78.03-2.47-1.88-1.91-3.55-4.02-4.98-6.29-.52-.82-1.6-1.07-2.41-.55-.815.515-1.06 1.596-.542 2.41zm14.09 13.62c2.53 1.48 5.21 2.69 8 3.6.92.3 1.91-.2 2.21-1.12.3-.92-.2-1.9-1.12-2.2-2.55-.84-5-1.94-7.32-3.3-.83-.48-1.9-.2-2.39.63s-.2 1.91.63 2.4zm18.71 5.58c.7.04 1.4.06 2.1.06.97 0 1.75-.78 1.75-1.75 0-.96-.78-1.75-1.75-1.75-.64 0-1.28-.01-1.92-.05-.96-.05-1.79.7-1.84 1.66-.05.97.7 1.79 1.66 1.84z"/><ellipse cx="190.196" cy="125.302" fill="#BEEBFB" stroke="#76D0F2" strokeWidth="3.5" rx="12.608" ry="12.597"/><ellipse cx="367.869" cy="139.397" fill="#BEEBFB" stroke="#76D0F2" strokeWidth="3.5" rx="8.405" ry="8.398"/><path fill="#BEEBFB" stroke="#76D0F2" strokeWidth="3.5" d="M145 283.652c10.83 0 19.61-8.773 19.61-19.595s-8.78-19.595-19.61-19.595c-10.832 0-19.613 8.773-19.613 19.595s8.78 19.595 19.612 19.595zm252.494 16.545c15.473 0 28.017-12.533 28.017-27.993 0-15.46-12.54-27.993-28.01-27.993s-28.02 12.54-28.02 28 12.55 28 28.02 28z"/><path stroke="#FFF" strokeWidth="4.2" d="M144.513 275.72c6.383 0 11.557-5.17 11.557-11.548m240.315 26.866c11.412 0 20.663-9.243 20.663-20.645" strokeLinecap="round"/><ellipse cx="369.834" cy="141.007" fill="#FFF" rx="2.101" ry="2.099"/><path stroke="#FFF" strokeWidth="2.8" d="M189.6 131.103c3.87 0 7.005-3.133 7.005-6.998" strokeLinecap="round"/></g></svg>);
	}
}
