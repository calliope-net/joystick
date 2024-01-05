
//% color=#BF3F7F icon="\uf08d" block="Joystick" weight=09
namespace qwiicjoystick
/* 230903 231011 https://github.com/calliope-net/joystick
SparkFun Qwiic Joystick
https://learn.sparkfun.com/tutorials/qwiic-joystick-hookup-guide#resources-and-going-further

https://github.com/sparkfun/Qwiic_Joystick
https://github.com/sparkfun/Qwiic_Joystick_Py
https://github.com/sparkfun/Qwiic_Joystick/blob/master/Firmware/Python%20Examples/Example%201%20-%20Basic%20Readings/Qwiic_Joystick.py

Code anhand der Python library neu programmiert von Lutz Elßner im September 2023
*/ {
    export enum eADDR { Joystick_x20 = 0x20 }
    let n_i2cCheck: boolean = false // i2c-Check
    let n_i2cError: number = 0 // Fehlercode vom letzten WriteBuffer (0 ist kein Fehler)
    let n_SendeZahl: Buffer = Buffer.create(4)

    export enum eRegister {     // Register codes for the Joystick
        ID = 0x00,              // Default I2C Slave Address from EEPROM
        VERSION1 = 0x01,        // Firmware Version (MSB First)
        VERSION2 = 0x02,
        X_MSB = 0x03,           // Current Horizontal Position (MSB First)
        //% block="X_LSB 2Bit: xx000000"
        X_LSB = 0x04,
        Y_MSB = 0x05,           // Current Vertical Position (MSB First)
        //% block="Y_LSB 2Bit: xx000000"
        Y_LSB = 0x06,
        //% block="BUTTON 0:gedrückt"
        BUTTON = 0x07,          // Current Button Position
        //% block="STATUS 1:gedrückt"
        STATUS = 0x08,          // Button Status: Indicates if button was pressed since last read of button state. Clears after read.
        I2C_LOCK = 0x09,        // Configuration or "Locking" Register - Prevents random I2C address changes during I2C scans and register dumps. Must be set to 0x13 before an address change gets saved to the EEPROM.
        CHANGE_ADDREESS = 0x0A  // Current/Set I2C Slave Address (Write). Stored in EEPROM.
    }


    //% group="beim Start"
    //% block="i2c %pADDR beim Start || i2c-Check %ck"
    //% pADDR.shadow="qwiicjoystick_eADDR"
    //% ck.shadow="toggleOnOff" ck.defl=1
    export function beimStart(pADDR: number, ck?: boolean) {
        n_i2cCheck = (ck ? true : false) // optionaler boolean Parameter kann undefined sein
        n_i2cError = 0 // Reset Fehlercode

        i2cWriteBuffer(pADDR, Buffer.fromArray([eRegister.STATUS, 0])) // (8) Status 'Button war gedrückt' löschen
    }

    // ========== group="Joystick in Array lesen 0:H 1:V 2:Button 3:Button-Status"

    export enum eBereich {
        //% block="0..512..1023"
        A_0_1023,
        //% block="0..128..255"
        B_0_255,
        //% block="-128..0..+127"
        C_128_127,
        //% block="-100..0..+100"
        D_100_100
    }
    //% group="Joystick in Array lesen 0:H 1:V 2:Button 3:Button-Status"
    //% block="i2c %pADDR in Array lesen: Bereich %pBereich || Nullstelle %von0 %bis0"
    //% expandableArgumentMode="toggle" von0.defl=0 bis0.defl=0
    //% pADDR.shadow="qwiicjoystick_eADDR"
    //% inlineInputMode=inline
    //% blockSetVariable=aJoy
    export function readArray(pADDR: number, pBereich: eBereich, von0?: number, bis0?: number): number[] {
        let a: number[] = [0, 0, 0, 0], h: number, v: number
        let bu = readBuffer(pADDR, eRegister.X_MSB, 6)

        switch (pBereich) {
            case eBereich.A_0_1023: {
                h = bu.getNumber(NumberFormat.UInt16BE, 0) / 64
                v = bu.getNumber(NumberFormat.UInt16BE, 2) / 64
                h = nullstelle(h, 512, von0, bis0)
                v = nullstelle(v, 512, von0, bis0)
                break
            }
            case eBereich.B_0_255: {
                h = bu.getUint8(0)
                v = bu.getUint8(2)
                h = nullstelle(h, 128, von0, bis0)
                v = nullstelle(v, 128, von0, bis0)
                break
            }
            case eBereich.C_128_127: {
                h = bu.getUint8(0) - 128
                v = bu.getUint8(2) - 128
                h = nullstelle(h, 0, von0, bis0)
                v = nullstelle(v, 0, von0, bis0)
                break
            }
            case eBereich.D_100_100: {
                // map: 0 -> -100 | 128 -> 0 / 255 -> +100
                // round: Kommastellen entfernen
                h = Math.round(Math.map(bu.getUint8(0), 0, 255, -100, 100))
                v = Math.round(Math.map(bu.getUint8(2), 0, 255, -100, 100))
                h = nullstelle(h, 0, von0, bis0)
                v = nullstelle(v, 0, von0, bis0)
                break
            }
        }

        a.set(0, h) // Current Horizontal Position
        a.set(1, v) // Current Vertical Position
        a.set(2, bu.getUint8(4)) // Current Button Position
        a.set(3, bu.getUint8(5)) // Button Status
        return a
    }


    // ========== group="Joystick Position (0..512..1023)"

    //% group="Joystick Position (0..512..1023)"
    //% block="i2c %pADDR horizontal X Position" weight=4
    //% pADDR.shadow="qwiicjoystick_eADDR"
    export function horizontal(pADDR: number) {
        let bu = readBuffer(pADDR, eRegister.X_MSB, 2)
        return bu.getNumber(NumberFormat.UInt16BE, 0) / 64
    }

    //% group="Joystick Position (0..512..1023)"
    //% block="i2c %pADDR vertical Y Position" weight=2
    //% pADDR.shadow="qwiicjoystick_eADDR"
    export function vertical(pADDR: number) {
        let bu = readBuffer(pADDR, eRegister.Y_MSB, 2)
        return bu.getNumber(NumberFormat.UInt16BE, 0) / 64
    }



    // ========== group="Joystick Button"

    export enum eButton {
        //% block="ist gedrückt"
        BUTTON,
        //% block="war gedrückt"
        STATUS
    }
    //% group="Joystick Button"
    //% block="i2c %pADDR Button %pButton" weight=5
    //% pADDR.shadow="qwiicjoystick_eADDR"
    export function button(pADDR: number, pButton: eButton): boolean {
        switch (pButton) {
            case eButton.BUTTON: return readRegister(pADDR, eRegister.BUTTON) == 0
            case eButton.STATUS: return readRegister(pADDR, eRegister.STATUS) == 1
            default: return false
        }
    }

    //% group="Joystick Button"
    //% block="i2c %pADDR Status 'Button war gedrückt' löschen" weight=4
    //% pADDR.shadow="qwiicjoystick_eADDR"
    export function clearButtonStatus(pADDR: number) {
        writeRegister(pADDR, eRegister.STATUS, 0)
    }


    // ========== group="Joystick als Text lesen"

    //% group="Joystick als Text lesen H V B S"
    //% block="i2c %pADDR Bereich %pBereich als Text"
    //% pBereich.defl=qwiicjoystick.eBereich.D_100_100
    //% pADDR.shadow="qwiicjoystick_eADDR"
    export function statuszeile(pADDR: number, pBereich: eBereich): string {
        let a = readArray(pADDR, pBereich)
        return a.get(0) + "!" + a.get(1) + "!" + a.get(2) + "!" + a.get(3)
    }


    //% group="Kommentar"
    //% block="// %text" weight=4
    export function comment(text: string): void { }



    // ========== advanced=true


    //% group="Joystick (0 .. 128 .. 255) für Fernsteuerung" advanced=true
    //% block="i2c %pADDR in UInt32LE lesen || %byte2" weight=4
    //% pADDR.shadow="qwiicjoystick_eADDR"
    //% byte2.min=0 byte2.max=100 byte2.defl=100
    export function readJoystick(pADDR: number, byte2?: number): number {
        let bu_ret = Buffer.create(4)

        i2cWriteBuffer(pADDR, Buffer.fromArray([3]), true) // Joystick Register ab Nummer 3

        let bu_joy = i2cReadBuffer(pADDR, 6) // Joystick 6 Register 3-8 lesen

        bu_ret.setUint8(0, bu_joy.getUint8(0)) // Register 3: Horizontal MSB 8 Bit
        bu_ret.setUint8(1, bu_joy.getUint8(2)) // Register 5: Vertical MSB 8 Bit
        if (byte2 == undefined) {
            //basic.showNumber(-1)
            bu_ret.setUint8(2, bu_joy.getUint8(4)) // Register 7: Current Button Position (0:gedrückt)
        } else {
            //basic.showNumber(byte2)
            bu_ret.setUint8(2, byte2)
        }
        bu_ret.setUint8(3, bu_joy.getUint8(5)) // Register 8: Button STATUS (1:war gedrückt)

        return bu_ret.getNumber(NumberFormat.UInt32LE, 0)
    }



    // ========== group="Fernsteuerung"

    export enum eOffset {
        //% block="0"
        z0 = 0,
        //% block="1"
        z1 = 1,
        //% block="2"
        z2 = 2,
        //% block="3"
        z3 = 3
    }

    //% group="Fernsteuerung" advanced=true
    //% block="setSendeZahl %pNumberFormat %pOffset %pValue" weight=4
    export function setSendeZahl(pNumberFormat: NumberFormat, pOffset: eOffset, pValue: number) {
        n_SendeZahl.setNumber(pNumberFormat, pOffset, pValue)
    }

    //% group="Fernsteuerung" advanced=true
    //% block="getSendeZahl UInt32LE" weight=2
    export function getSendeZahl() {
        return n_SendeZahl.getNumber(NumberFormat.UInt32LE, 0)
    }



    // ========== group="Nullstelle Abweichung von-bis als Nullwert werten"

    //% group="Nullstelle Abweichung von-bis als Nullwert werten" advanced=true
    //% block="Nullstelle value %value nullwert %nullwert von %von0 bis %bis0"
    //% inlineInputMode=inline
    export function nullstelle(value: number, nullwert: number, von0: number, bis0: number) {
        if (value < nullwert && value >= (nullwert + von0)) { value = nullwert }
        if (value > nullwert && value <= (nullwert + bis0)) { value = nullwert }
        return value
    }


    // ========== group="i2c Register"

    //% group="i2c Register" advanced=true
    //% block="i2c %pADDR Register %pRegister 8 Bit lesen" weight=8
    //% pADDR.shadow="qwiicjoystick_eADDR"
    export function readRegister(pADDR: number, pRegister: eRegister) {
        let bu = Buffer.create(1)
        bu.setUint8(0, pRegister)
        i2cWriteBuffer(pADDR, bu, true)
        return i2cReadBuffer(pADDR, 1).getUint8(0)
    }

    //% group="i2c Register" advanced=true
    //% block="i2c %pADDR Register ab %register %size Byte in Buffer lesen" weight=6
    //% pADDR.shadow="qwiicjoystick_eADDR"
    //% size.min=1 size.max=11 size.defl=1
    export function readBuffer(pADDR: number, pRegister: eRegister, size: number): Buffer {
        let bu = Buffer.create(1)
        bu.setUint8(0, pRegister)
        i2cWriteBuffer(pADDR, bu, true)
        return i2cReadBuffer(pADDR, size)
    }

    //% group="i2c Register" advanced=true
    //% block="i2c %pADDR Register %pRegister 1 Byte %value schreiben" weight=4
    //% value.defl=19
    //% pADDR.shadow="qwiicjoystick_eADDR"
    export function writeRegister(pADDR: number, pRegister: eRegister, value: number) {
        let bu = Buffer.create(2)
        bu.setUint8(0, pRegister)
        bu.setUint8(1, value)
        i2cWriteBuffer(pADDR, bu)
    }

    //% blockId=qwiicjoystick_eRegister
    //% group="i2c Register" advanced=true
    //% block="Registernummer %pRegister" weight=2
    export function qwiicjoystick_eRegister(pRegister: eRegister): number { return pRegister }



    // ========== group="i2c Adressen"

    //% blockId=qwiicjoystick_eADDR
    //% group="i2c Adressen" advanced=true
    //% block="%pADDR" weight=6
    export function qwiicjoystick_eADDR(pADDR: eADDR): number { return pADDR }

    //% group="i2c Adressen" advanced=true
    //% block="i2c Fehlercode" weight=2
    export function i2cError() { return n_i2cError }

    function i2cWriteBuffer(pADDR: number, buf: Buffer, repeat: boolean = false) {
        if (n_i2cError == 0) { // vorher kein Fehler
            n_i2cError = pins.i2cWriteBuffer(pADDR, buf, repeat)
            if (n_i2cCheck && n_i2cError != 0)  // vorher kein Fehler, wenn (n_i2cCheck=true): beim 1. Fehler anzeigen
                basic.showString(Buffer.fromArray([pADDR]).toHex()) // zeige fehlerhafte i2c-Adresse als HEX
        } else if (!n_i2cCheck)  // vorher Fehler, aber ignorieren (n_i2cCheck=false): i2c weiter versuchen
            n_i2cError = pins.i2cWriteBuffer(pADDR, buf, repeat)
        //else { } // n_i2cCheck=true und n_i2cError != 0: weitere i2c Aufrufe blockieren
    }

    function i2cReadBuffer(pADDR: number, size: number, repeat: boolean = false): Buffer {
        if (!n_i2cCheck || n_i2cError == 0)
            return pins.i2cReadBuffer(pADDR, size, repeat)
        else
            return Buffer.create(size)
    }

} // qwiicjoystick.ts
