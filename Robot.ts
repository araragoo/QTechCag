// https://github.com/araragoo/QTechCag

//% weight=5 color=#0fbc11 icon="\uf112" block="Robot"
namespace Robot {

    // モータアドレス
    const DRV_ADR1 = 0x64  // DRV8830のI2Cアドレス A1 = open,  A0 = open
    const DRV_ADR2 = 0x65  // DRV8830のI2Cアドレス A1 = open,  A0 = 1
    const CTR_ADR  = 0x00  // CONTROLレジスタのサブアドレス
    const FLT_ADR  = 0x01  // FAULTレジスタのアドレス

    // ブリッジ制御
    const M_STANBY  = 0 //B00   // スタンバイ   
    const M_REVERSE = 1 //B01   // 逆転
    const M_NORMAL  = 2 //B10   // 正転
    const M_BRAKE   = 3 //B11   // ブレーキ

    const DRV_MIN      =    0 //  0V
    const DRV_MAX      =  100 //  3Vmax
    const DRV_MIN_B    =    0 //  0lsb
    const DRV_MAX_B    =   37 //  6-37lsb : 0.48-5.06V   3Vmax -> (3.0-0.48)/(5.06-0.48)*(63-6)+6 = 37lsb
    const DRV_MAXMAX_B = 0x3F

    // サーボ
    const PCA9685_ADDRESS = 0x40
    const MODE1 = 0x00
    const PRESCALE = 0xFE
    const LED0_ON_L = 0x06

    const PWM_FREQUENCY = 50              //50Hz 20ms
    const PWM_MAX       = 2400*4096/20000 //2.4ms
    const PWM_MIN       = 500*4096/20000  //0.5ms
    const PWM_MAX_B     = 4095            //4095lsb
    const PWM_MIN_B     = 0               //   0lsb

    const DEGREE_MIN = -90 //-90deg.
    const DEGREE_MAX =  90 // 90deg.
    const LED_MIN    =   0 //  0V
    const LED_MAX    = 100 //3.3V

    let initialized = false

    let WAIST0 = 15;
    let Waist  = 0;
    let FrontR = 0;
    let FrontL = 0;
    let RearR  = 0;
    let RearL  = 0;

    function i2cwrite(addr: number, reg: number, value: number) {
        let buf = pins.createBuffer(2);
        buf[0] = reg;
        buf[1] = value;
        pins.i2cWriteBuffer(addr, buf);
    }

    function i2cread(addr: number, reg: number) {
        pins.i2cWriteNumber(addr, reg, NumberFormat.UInt8BE);
        let val = pins.i2cReadNumber(addr, NumberFormat.UInt8BE);
        return val;
    }

    function driveMotor(channel: number, voltage: number) {

        let adr = DRV_ADR1;
        switch (channel) {
            case 0: adr = DRV_ADR1; break;
            case 1: adr = DRV_ADR2; break;
            default : return;
        }

        let ctr = M_STANBY;
        if (voltage == 0) {
            ctr = M_STANBY;
        } else if (voltage > 0) {
            ctr = M_NORMAL;
        } else {
            ctr = M_REVERSE;
            voltage = -voltage;
        }

        let val = voltage;
        if(val > DRV_MAX) val = DRV_MAX;
        if(val < DRV_MIN) val = DRV_MIN;
        
        val = (val - DRV_MIN)*((DRV_MAX_B - DRV_MIN_B) / (DRV_MAX - DRV_MIN)) + DRV_MIN_B;
        val = ctr + (val << 2);

        i2cwrite(adr, CTR_ADR, val);
    }


    function initPCA9685(): void {
        i2cwrite(PCA9685_ADDRESS, MODE1, 0x00)
        setFreq(50); //50Hz
        setPwm(0, 0, 4095);
        for (let idx = 0; idx < 16; idx++) {
            setPwm(idx, 0, 0);
        }
        initialized = true
    }

    function setFreq(freq: number): void {
        // Constrain the frequency
        // freq *= 0.9;  // Correct for overshoot in the frequency setting (see issue #11).
        let prescaleval = 25000000;
        prescaleval /= 4096;
        prescaleval /= freq;
        prescaleval -= 1;
        let prescale = prescaleval; //Math.Floor(prescaleval + 0.5);
        let oldmode = i2cread(PCA9685_ADDRESS, MODE1);
        let newmode = (oldmode & 0x7F) | 0x10; // sleep
        i2cwrite(PCA9685_ADDRESS, MODE1, newmode); // go to sleep
        i2cwrite(PCA9685_ADDRESS, PRESCALE, prescale); // set the prescaler
        i2cwrite(PCA9685_ADDRESS, MODE1, oldmode);
        control.waitMicros(5000);
        i2cwrite(PCA9685_ADDRESS, MODE1, oldmode | 0xa1);
    }

    function setPwm(channel: number, on: number, off: number): void {
        if (channel < 0 || channel > 15)
            return;

        let buf = pins.createBuffer(5);
        buf[0] = LED0_ON_L + 4 * channel;
        buf[1] = on & 0xff;
        buf[2] = (on >> 8) & 0xff;
        buf[3] = off & 0xff;
        buf[4] = (off >> 8) & 0xff;
        pins.i2cWriteBuffer(PCA9685_ADDRESS, buf);
    }

    //  subcategory="Robot"
    //% blockId=setRadio block="radio Group:1<=>83 %n"
    //% weight=85
    //% n.min=1 n.max=83
    export function radioGroup(n: number): void {
        radio.setGroup(n)
    }

    //  subcategory="Robot"
    //% blockId=setMortor block="Motor Right:0 Left:1 %channel|BWD<=>FWD:-100<=>100 %voltage"
    //% weight=85
    //% channel.min=0 channel.max=1
    //% voltage.min=-100 voltage.max=100
    export function Motor(channel: number,voltage: number): void {
        driveMotor(channel, voltage);
    }

    //  subcategory="Robot"
    //  blockId=setServo block="Servo LowR:0 LowL:1 HighR:2 HighL:3 %channel|degree:-45<=>45 %degree"
    //% blockId=setServo block="Servo Waist:0 FrontR:1 FrontL:2 RearR:3 RearL:4 %channel|degree:-90<=>90 %degree"
    //% weight=85
    //% channel.min=0 channel.max=4
    //% degree.min=-90 degree.max=90
    export function Servo(channel: number,degree: number): void {
        if (!initialized) {
            initPCA9685();
        }
        let deg = 90 + degree;
        if (channel == 2 || channel == 4)
            deg = 90 - degree;

        if     (deg <   0) deg =   0;
        else if(deg > 180) deg = 180;

        let v_us = (deg * 95 / 9 + 500); // 0.5 ~ 2.4 ms <=> offset 0dge.
//        let v_us = (deg * 95 / 9 + 500 + 1900*120/180); // 0.5 ~ 2.4 ms <=> offset 120dge.
//        let v_us = ((deg+100) * 1900 / 180 + 500); // 0.5 ~ 2.4 ms
        let val = v_us * 4096 / 20000; // 50hz: 20,000 us
        setPwm(channel+3, 0, val);

        if     (channel == 0) Waist  = degree;
        else if(channel == 1) FrontR = degree;
        else if(channel == 2) FrontL = degree;
        else if(channel == 3) RearR  = degree;
        else if(channel == 4) RearL  = degree;
    }

    //  subcategory="Robot"
    //% blockId=setUpRight block="Upright time[s]:0.5<=>5 %time""
    //% weight=85
    //% time.min=0.5 time.max=5
    export function upRight(time: number): void {
        if (!initialized) {
            initPCA9685();
        }
        if(time   == 0) time = 1;

        let n = time * 10;
        
        let wt = - Waist  / n;
        let fr = - FrontR / n;
        let fl = - FrontL / n;
        let rr = - RearR  / n;
        let rl = - RearL  / n;

        for (let i = 0; i < n; i++) {
            Servo(0, Waist  + wt); control.waitMicros(20000);
            Servo(1, FrontR + fr); control.waitMicros(20000);
            Servo(2, FrontL + fl); control.waitMicros(20000);
            Servo(3, RearR  + rr); control.waitMicros(20000);
            Servo(4, RearL  + rl); control.waitMicros(20000);
        }
        Servo(0, 0); control.waitMicros(20000);
        Servo(1, 0); control.waitMicros(20000);
        Servo(2, 0); control.waitMicros(20000);
        Servo(3, 0); control.waitMicros(20000);
        Servo(4, 0); control.waitMicros(20000);
    }

    //  subcategory="Robot"
    //% blockId=setSitDown block="Sit Down time[s]:0.5<=>5 %time""
    //% weight=85
    //% time.min=0.5 time.max=5
    export function sitDown(time: number): void {
        if (!initialized) {
            initPCA9685();
        }
        if(time   == 0) time = 1;

        let n = time * 10;
        
        let wt = (      0 - Waist ) / n;
        let fr = (     30 - FrontR) / n;
        let fl = (     30 - FrontL) / n;
        let rr = (      0 - RearR)  / n;
        let rl = (     30 - RearL)  / n;

        for (let i = 0; i < n; i++) {
            Servo(0, Waist  + wt); control.waitMicros(20000);
            Servo(1, FrontR + fr); control.waitMicros(20000);
            Servo(2, FrontL + fl); control.waitMicros(20000);
            Servo(3, RearR  + rr); control.waitMicros(20000);
            Servo(4, RearL  + rl); control.waitMicros(20000);
        }
        Servo(0,      0); control.waitMicros(20000);
        Servo(1,     30); control.waitMicros(20000);
        Servo(2,     30); control.waitMicros(20000);
        Servo(3,      0); control.waitMicros(20000);
        Servo(4,     30); control.waitMicros(20000);

        wt = (  0 - Waist ) / n;
        fr = (-30 - FrontR) / n;
        fl = (-30 - FrontL) / n;
        rr = ( 30 - RearR)  / n;
        rl = ( 30 - RearL)  / n;

        for (let i = 0; i < n; i++) {
            Servo(0, Waist  + wt); control.waitMicros(20000);
            Servo(1, FrontR + fr); control.waitMicros(20000);
            Servo(2, FrontL + fl); control.waitMicros(20000);
            Servo(3, RearR  + rr); control.waitMicros(20000);
            Servo(4, RearL  + rl); control.waitMicros(20000);
        }
        Servo(0,   0); control.waitMicros(20000);
        Servo(1, -30); control.waitMicros(20000);
        Servo(2, -30); control.waitMicros(20000);
        Servo(3,  30); control.waitMicros(20000);
        Servo(4,  30); control.waitMicros(20000);
    }

    //  subcategory="Robot"
    //% blockId=setHappiness block="Happiness time[s]:0.5<=>5 %time""
    //% weight=85
    //% time.min=0.5 time.max=5
    export function happiness(time: number): void {
        if (!initialized) {
            initPCA9685();
        }
        if(time   == 0) time = 1;

        let n = time * 10;
        
        let wt = (  0 - Waist ) / n;
        let fr = ( 90 - FrontR) / n;
        let fl = ( 90 - FrontL) / n;
        let rr = (-90 - RearR)  / n;
        let rl = (-90 - RearL)  / n;

        for (let i = 0; i < n; i++) {
            Servo(0, Waist  + wt); control.waitMicros(20000);
            Servo(1, FrontR + fr); control.waitMicros(20000);
            Servo(2, FrontL + fl); control.waitMicros(20000);
            Servo(3, RearR  + rr); control.waitMicros(20000);
            Servo(4, RearL  + rl); control.waitMicros(20000);
        }
        Servo(0,   0); control.waitMicros(20000);
        Servo(1,  90); control.waitMicros(20000);
        Servo(2,  90); control.waitMicros(20000);
        Servo(3, -90); control.waitMicros(20000);
        Servo(4, -90); control.waitMicros(20000);
    }

    //  subcategory="Robot"
    //% blockId=setWalkRight block="Walk Right degree:-60<=>60 %degree|time[s]:0.5<=>5 %time"
    //% weight=85
    //% degree.min=-60 degree.max=60
    //% time.min=0.5 time.max=5
    export function walkRight(degree: number, time: number): void {
        if (!initialized) {
            initPCA9685();
        }
        if(degree == 0) degree = 45;
        if(time   == 0) time = 1;
        let n = time * 10 / 2;

        let wt = (-WAIST0 - Waist ) / n;
        let fr = ( degree - FrontR) / n;
        let fl = (-degree - FrontL) / n;
        let rr = (-degree - RearR)  / n;
        let rl = (      0 - RearL)  / n;

        for (let i = 0; i < n; i++) {
            Servo(0, Waist  + wt); control.waitMicros(20000);
            Servo(1, FrontR + fr); control.waitMicros(20000);
            Servo(2, FrontL + fl); control.waitMicros(20000);
            Servo(3, RearR  + rr); control.waitMicros(20000);
            Servo(4, RearL  + rl); control.waitMicros(20000);
        }

        Servo(0, -WAIST0); control.waitMicros(20000);
        Servo(1,  degree); control.waitMicros(20000);
        Servo(2, -degree); control.waitMicros(20000);
        Servo(3, -degree); control.waitMicros(20000);
        Servo(4,       0); control.waitMicros(20000);

        wt = ( WAIST0 - Waist ) / n;
        fr = ( degree - FrontR) / n;
        fl = (-degree - FrontL) / n;
        rr = (      0 - RearR)  / n;
        rl = ( -degree- RearL)  / n;

        for (let i = 0; i < n; i++) {
            Servo(0, Waist  + wt); control.waitMicros(20000);
            Servo(1, FrontR + fr); control.waitMicros(20000);
            Servo(2, FrontL + fl); control.waitMicros(20000);
            Servo(3, RearR  + rr); control.waitMicros(20000);
            Servo(4, RearL  + rl); control.waitMicros(20000);
        }
        Servo(0,  WAIST0); control.waitMicros(20000);
        Servo(1,  degree); control.waitMicros(20000);
        Servo(2, -degree); control.waitMicros(20000);
        Servo(3,       0); control.waitMicros(20000);
        Servo(4, -degree); control.waitMicros(20000);
    }

    //  subcategory="Robot"
    //% blockId=setWalkLeft block="Walk Left degree:-60<=>60 %degree|time[s]:0.5<=>5 %time"
    //% weight=85
    //% degree.min=-60 degree.max=60
    //% time.min=0.5 time.max=5
    export function walkLeft(degree: number, time: number): void {
        if (!initialized) {
            initPCA9685();
        }
        if(degree == 0) degree = 45;
        if(time   == 0) time = 1;
        let n = time * 10 / 2;

        let wt = ( WAIST0 - Waist ) / n;
        let fr = (-degree - FrontR) / n;
        let fl = ( degree - FrontL) / n;
        let rr = (      0- RearR)  / n;
        let rl = (-degree - RearL)  / n;

        for (let i = 0; i < n; i++) {
            Servo(0, Waist  + wt); control.waitMicros(20000);
            Servo(1, FrontR + fr); control.waitMicros(20000);
            Servo(2, FrontL + fl); control.waitMicros(20000);
            Servo(3, RearR  + rr); control.waitMicros(20000);
            Servo(4, RearL  + rl); control.waitMicros(20000);
        }

        Servo(0,  WAIST0); control.waitMicros(20000);
        Servo(1, -degree); control.waitMicros(20000);
        Servo(2,  degree); control.waitMicros(20000);
        Servo(3,       0); control.waitMicros(20000);
        Servo(4, -degree); control.waitMicros(20000);

        wt = (-WAIST0 - Waist ) / n;
        fr = (-degree - FrontR) / n;
        fl = ( degree - FrontL) / n;
        rr = (-degree - RearR)  / n;
        rl = (      0- RearL)  / n;

        for (let i = 0; i < n; i++) {
            Servo(0, Waist  + wt); control.waitMicros(20000);
            Servo(1, FrontR + fr); control.waitMicros(20000);
            Servo(2, FrontL + fl); control.waitMicros(20000);
            Servo(3, RearR  + rr); control.waitMicros(20000);
            Servo(4, RearL  + rl); control.waitMicros(20000);
        }
        Servo(0, -WAIST0); control.waitMicros(20000);
        Servo(1, -degree); control.waitMicros(20000);
        Servo(2,  degree); control.waitMicros(20000);
        Servo(3, -degree); control.waitMicros(20000);
        Servo(4,       0); control.waitMicros(20000);
    }

    //  subcategory="Robot"
    //% blockId=setSetWaist block="Waist degree:-60<=>60 %degree"
    //% weight=85
    //% degree.min=-60 degree.max=60
    export function setWaist(degree: number): void {
        if (!initialized) {
            initPCA9685();
        }
        WAIST0 = degree;
    }

    //% subcategory="Music1"
    //% blockId=setDog block="dog"
    //% weight=85
    export function dog(): void {
        if (!initialized) {
            initPCA9685();
        }
        music.playTone(440, music.beat(BeatFraction.Half))
        music.playTone(349, music.beat(BeatFraction.Half))
        music.playTone(392, music.beat(BeatFraction.Half))
        music.playTone(587, music.beat(BeatFraction.Whole))
        music.rest(music.beat(BeatFraction.Half))
        music.playTone(523, music.beat(BeatFraction.Half))
        music.playTone(392, music.beat(BeatFraction.Half))
        music.playTone(440, music.beat(BeatFraction.Half))
        music.playTone(349, music.beat(BeatFraction.Whole))
        music.rest(music.beat(BeatFraction.Half))
    }

    //% subcategory="Music1"
    //% blockId=setCat block="cat"
    //% weight=85
    export function cat(): void {
        if (!initialized) {
            initPCA9685();
        }
        music.playTone(523, music.beat(BeatFraction.Half))
        music.playTone(440, music.beat(BeatFraction.Half))
        music.playTone(523, music.beat(BeatFraction.Half))
        music.playTone(698, music.beat(BeatFraction.Whole))
        music.rest(music.beat(BeatFraction.Half))
        music.playTone(523, music.beat(BeatFraction.Half))
        music.playTone(440, music.beat(BeatFraction.Half))
        music.playTone(523, music.beat(BeatFraction.Half))
        music.playTone(392, music.beat(BeatFraction.Whole))
        music.rest(music.beat(BeatFraction.Half))
    }

    //  subcategory="Robot"
    //% blockId=setLED block="LED Red:0 Green:1 Blue:2 %channel|voltage:0<=>100 %voltage"
    //% weight=85
    //% channel.min=0 channel.max=2
    //% voltage.min=0 voltage.max=100
    export function LED(channel: number,voltage: number): void {
        if (!initialized) {
            initPCA9685();
        }
        let val = voltage * 81 / 2;
//        val = val * 4095 / 100;
        setPwm(channel, 0, val);
    }
} 
