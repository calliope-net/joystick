
//% color=#BF3F7F icon="\uf08d" block="Joystick" weight=09
namespace qwiicjoystick
/* 230903 https://github.com/calliope-net/joystick
SparkFun Qwiic Joystick
https://learn.sparkfun.com/tutorials/qwiic-joystick-hookup-guide#resources-and-going-further

https://github.com/sparkfun/Qwiic_Joystick
https://github.com/sparkfun/Qwiic_Joystick_Py
https://github.com/sparkfun/Qwiic_Joystick/blob/master/Firmware/Python%20Examples/Example%201%20-%20Basic%20Readings/Qwiic_Joystick.py

Code anhand der Python library neu programmiert von Lutz Elßner im September 2023
*/ {
    export enum eADDR { Joystick = 0x20 }

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

    let m_i2cWriteBufferError: number = 0 // Fehlercode vom letzten WriteBuffer (0 ist kein Fehler)


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


    // ========== group="Joystick Position"

    //% group="Joystick Position"
    //% block="i2c %pADDR horizontal X Position" weight=4
    //% pADDR.shadow="qwiicjoystick_eADDR"
    export function horizontal(pADDR: number) {
        let bu = readBuffer(pADDR, eRegister.X_MSB, 2)
        return bu.getNumber(NumberFormat.UInt16BE, 0) / 64
    }

    //% group="Joystick Position"
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
            case eButton.BUTTON: return readRegister(pADDR, eRegister.STATUS) == 1
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




    // ========== advanced=true

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
        m_i2cWriteBufferError = pins.i2cWriteBuffer(pADDR, bu, true)
        return pins.i2cReadBuffer(pADDR, 1).getUint8(0)
    }

    //% group="i2c Register" advanced=true
    //% block="i2c %pADDR Register ab %register %size Byte in Buffer lesen" weight=6
    //% pADDR.shadow="qwiicjoystick_eADDR"
    //% size.min=1 size.max=11 size.defl=1
    export function readBuffer(pADDR: number, pRegister: eRegister, size: number): Buffer {
        let bu = Buffer.create(1)
        bu.setUint8(0, pRegister)
        m_i2cWriteBufferError = pins.i2cWriteBuffer(pADDR, bu, true)
        return pins.i2cReadBuffer(pADDR, size)
    }

    //% group="i2c Register" advanced=true
    //% block="i2c %pADDR Register %pRegister 1 Byte %value schreiben" weight=4
    //% value.defl=19
    //% pADDR.shadow="qwiicjoystick_eADDR"
    export function writeRegister(pADDR: number, pRegister: eRegister, value: number) {
        let bu = Buffer.create(2)
        bu.setUint8(0, pRegister)
        bu.setUint8(1, value)
        m_i2cWriteBufferError = pins.i2cWriteBuffer(pADDR, bu)
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
    //% block="Fehlercode vom letzten WriteBuffer (0 ist kein Fehler)" weight=2
    export function i2cError() { return m_i2cWriteBufferError }

} // qwiicjoystick.ts
