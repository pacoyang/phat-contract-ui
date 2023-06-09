import type { ReactNode } from 'react'
import type { Result, U64 } from '@polkadot/types'

import React, { Suspense, useState, useEffect, useCallback } from 'react'
import tw from 'twin.macro'
import {
  Button,
  Spinner,
  Text,
  Alert,
  AlertIcon,
  AlertTitle,
  FormControl,
  FormLabel,
  Step,
  StepIcon,
  StepIndicator,
  StepNumber,
  StepSeparator,
  StepStatus,
  Stepper,
  NumberInput,
  NumberInputField,
  ButtonGroup,
  useToast,
  IconButton,
} from '@chakra-ui/react'
import { VscClose, VscCopy } from 'react-icons/vsc'
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import CopyToClipboard from 'react-copy-to-clipboard'
import { Link } from '@tanstack/react-location'
import { find } from 'ramda'
import { CertificateData, PinkCodePromise, PinkBlueprintPromise, create, signCertificate } from '@phala/sdk'
import { Abi } from '@polkadot/api-contract'
import Decimal from 'decimal.js'
import * as R from 'ramda'

import { Select } from '@/components/inputs/select'
import { currentAccountAtom, signerAtom } from '@/features/identity/atoms'
import {
  candidateAtom,
  currentClusterIdAtom,
  availableClusterOptionsAtom,
  candidateFileInfoAtom,
  contractSelectedInitSelectorAtom,
  phatRegistryAtom,
  localContractsAtom,
} from '../atoms'
import ContractFileUpload from './contract-upload'
import InitSelectorField from './init-selector-field'
import { apiPromiseAtom } from '../../parachain/atoms'
import signAndSend from '@/functions/signAndSend'
import { RESET } from 'jotai/utils'


const ClusterIdSelect = () => {
  const [clusterId, setClusterId] = useAtom(currentClusterIdAtom)
  const options = useAtomValue(availableClusterOptionsAtom)
  useEffect(() => {
    if (options && options.length > 0) {
      setClusterId(prev => {
        if (!prev) {
          return options[0].value
        }
        const result = find(i => i.value === prev, options)
        if (!result) {
          return options[0].value
        }
        return prev
      })
    }
  }, [setClusterId, options])
  if (!options.length) {
    return (
      <Alert status="warning">
        <AlertIcon />
        <AlertTitle>RPC is not Ready</AlertTitle>
      </Alert>
    )
  }
  return (
    <Select value={clusterId} onChange={setClusterId} options={options} />
  )
}

//
//
//

const cachedCertAtom = atom<Pairs<string, CertificateData | null>>(['', null])

const hasCertAtom = atom(get => {
  const current = get(cachedCertAtom)
  const account = get(currentAccountAtom)
  return account?.address === current[0] && current[1] !== null
})

function useRequestSign() {
  const [isWaiting, setIsWaiting] = useState(false)
  const [isReady, setIsReady] = useState(false)

  const api = useAtomValue(apiPromiseAtom)
  const account = useAtomValue(currentAccountAtom)
  const signer = useAtomValue(signerAtom)
  const setCachedCert = useSetAtom(cachedCertAtom)

  useEffect(() => {
    if (api && account && signer) {
      setIsReady(true)
    } else {
      setIsReady(false)
    }
  }, [setIsReady, api, account, signer])

  const requestSign = useCallback(async () => {
    if (!api || !account) {
      throw new Error('You need connected to an endpoint & pick a account first.')
    }
    if (!signer) {
      throw new Error('Unexpected Error: you might not approve the access to the wallet extension or the wallet extension initialization failed.')
    }
    try {
      setIsWaiting(true)
      const cert = await signCertificate({ signer, account, api })
      setCachedCert([account.address, cert])
      return cert
    } catch (err) {
      return null
    } finally {
      setIsWaiting(false)
    }
  }, [api, account, signer, setIsWaiting, setCachedCert])

  return { isReady, isWaiting, requestSign }
}

const RequestCertButton = ({children}: { children: ReactNode }) => {
  const { isReady, isWaiting, requestSign } = useRequestSign()
  return (
    <Button isLoading={isWaiting} isDisabled={!isReady} onClick={requestSign}>
      {children}
    </Button>
  )
}

//
//
//

const selectedContructorAtom = atom((get) => {
  const contract = get(candidateAtom)
  const chooseInitSelector = get(contractSelectedInitSelectorAtom)
  if (!contract) {
    return null
  }
  const spec = contract.V3 ? contract.V3.spec : contract.spec
  if (spec.constructors.length === 0) {
    throw new Error('No constructor found.')
  }
  const defaultInitSelector = R.pipe(
    R.filter((c: ContractMetaConstructor) => c.label === 'default' || c.label === 'new'),
    R.sortBy((c: ContractMetaConstructor) => c.args.length),
    i => R.head<ContractMetaConstructor>(i),
    (i) => i ? i.selector : undefined,
  )(spec.constructors)
  const initSelector = chooseInitSelector || defaultInitSelector || R.head(spec.constructors)?.selector
  console.log('user choose initSelector: ', chooseInitSelector)
  console.log('default initSelector: ', defaultInitSelector)
  if (!initSelector) {
    throw new Error('No valid initSelector specified.')
  }
  return R.prop('label', R.find(i => i.selector === initSelector, spec.constructors))
})

const blueprintPromiseAtom = atom<PinkBlueprintPromise | null>(null)

const instantiatedContractIdAtom = atom<string | null>(null)

const currentAbiAtom = atom(get => {
  const candidate = get(candidateAtom)
  if (!candidate) {
    return null
  }
  const abi = new Abi(candidate)
  return abi
})

function getDefaultInitSelector(abi: Abi) {
  const defaultInitSelector = R.pipe(
    R.filter((c: ContractMetaConstructor) => c.label === 'default' || c.label === 'new'),
    R.sortBy((c: ContractMetaConstructor) => c.args.length),
    i => R.head<ContractMetaConstructor>(i),
    (i) => i ? i.selector : undefined,
  )(abi.constructors)
  return defaultInitSelector || R.head(abi.constructors)?.selector
}

const hasParametersAtom = atom(get => {
  const abi = get(currentAbiAtom)
  if (!abi || !abi.constructors.length) {
    return false
  }
  const chooseInitSelector = get(contractSelectedInitSelectorAtom)
  const defaultInitSelector = getDefaultInitSelector(abi)
  const initSelector = chooseInitSelector || defaultInitSelector
  const target = R.find(i => i.selector === initSelector, abi.constructors)
  if (target && target.args.length > 0) {
    return true
  }
  return false
})

const currentStepAtom = atom(get => {
  const cachedCert = get(cachedCertAtom)
  const finfo = get(candidateFileInfoAtom)
  const hasParameters = get(hasParametersAtom)
  const blueprint = get(blueprintPromiseAtom)
  const instantiatedContractId = get(instantiatedContractIdAtom)
  if (!finfo.size) {
    return 0
  }
  if (hasParameters || !blueprint) {
    return 1
  }
  if (cachedCert[1] === null) {
    return 2
  }
  if (instantiatedContractId) {
    return 4
  }
  if (blueprint) {
    return 3
  }
  return 2
})

const currentBalanceAtom = atom(0)

function useClusterBalance() {
  const [currentBalance, setCurrentBalance] = useAtom(currentBalanceAtom)
  const [isLoading, setIsLoading] = useState(false)

  const [,cert] = useAtomValue(cachedCertAtom)
  const registry = useAtomValue(phatRegistryAtom)
  const currentAccount = useAtomValue(currentAccountAtom)
  const signer = useAtomValue(signerAtom)

  const getBalance = useCallback(async () => {
    if (!registry || !currentAccount || !cert) {
      return { total: 0, free: 0 }
    }
    const { address } = currentAccount
    const system = registry.systemContract
    if (!system) {
      return { total: 0, free: 0 }
    }
    try {
      const { output: totalBalanceOf } = await system.query['system::totalBalanceOf'](address, { cert }, address)
      const { output: freeBalanceOf } = await system.query['system::freeBalanceOf'](address, { cert }, address)
      const total = (totalBalanceOf as unknown as Result<U64, any>).asOk.toNumber() / 1e12
      const free = (freeBalanceOf as unknown as Result<U64, any>).asOk.toNumber() / 1e12
      return { total, free }
    } catch (err) {
      return { total: 0, free: 0 }
    }
  }, [registry, currentAccount, cert])

  const refreshBalance = useCallback(async () => {
    const result = await getBalance()
    setCurrentBalance(result.free)
  }, [getBalance, setCurrentBalance])

  useEffect(() => {
    (async function() {
      setIsLoading(true)
      const result = await getBalance()
      setCurrentBalance(result.free)
      setIsLoading(false)
    })();
  }, [getBalance])

  const transfer = useCallback(async (value: Decimal) => {
    if (!currentAccount || !signer) {
      return
    }
    const rounded = Number(value.mul(1e12).toFixed(0)) + 1
    setIsLoading(true)
    try {
      const { address } = currentAccount
      await signAndSend(registry.transferToCluster(address, rounded), address, signer)
      // @FIXME wait for next block
      await new Promise(resolve => setTimeout(resolve, 5000))
      await refreshBalance()
    } finally {
      setIsLoading(false)
    }
  }, [registry, currentAccount, signer, setCurrentBalance, setIsLoading, refreshBalance])

  return { currentBalance, isLoading, transfer, getBalance, refreshBalance }
}

function useUploadCode() {
  const [isLoading, setIsLoading] = useState(false)
  const { requestSign } = useRequestSign()

  const [, cert] = useAtomValue(cachedCertAtom)
  const registry = useAtomValue(phatRegistryAtom)
  const contract = useAtomValue(candidateAtom)
  const currentAccount = useAtomValue(currentAccountAtom)
  const signer = useAtomValue(signerAtom)
  const setBlueprintPromise = useSetAtom(blueprintPromiseAtom)
  const constructor = useAtomValue(selectedContructorAtom)

  const upload = useCallback(async () => {
    if (!contract || !constructor) {
      return
    }
    setIsLoading(true)
    try {
      let _cert = cert
      if (!_cert) {
        _cert = await requestSign()
      }
      if (!_cert) {
        // TODO show toast.
        return
      }
      const codePromise = new PinkCodePromise(registry.api, registry, contract, contract.source.wasm)
      // @ts-ignore
      const { result: uploadResult } = await signAndSend(codePromise.tx.new({}), currentAccount.address, signer)
      await uploadResult.waitFinalized(currentAccount, _cert, 120_000)
      setBlueprintPromise(uploadResult.blueprint)
    } finally {
      setIsLoading(false)
    }
  }, [registry, contract, currentAccount, cert, constructor, setBlueprintPromise])

  return { isLoading, upload }
}

function useReset() {
  const setCandidate = useSetAtom(candidateAtom)
  const setCandidateFileInfo = useSetAtom(candidateFileInfoAtom)
  const setBlueprintPromise = useSetAtom(blueprintPromiseAtom)
  const setInstantiatedContractId = useSetAtom(instantiatedContractIdAtom)
  const reset = useCallback(() => {
    setCandidate(null)
    setCandidateFileInfo(RESET)
    setBlueprintPromise(null)
    setInstantiatedContractId(null)
  }, [setCandidate, setBlueprintPromise, setInstantiatedContractId, setCandidateFileInfo])
  return reset
}


// Step Container

function StepSection({ children, index, isEnd }: { children: ReactNode, index: number, isEnd?: boolean }) {
  const currentStep = useAtomValue(currentStepAtom)
  if (currentStep < index) {
    return null
  }
  return (
    <Step tw="w-full">
      <StepIndicator tw="mt-0.5">
        <StepStatus
          complete={<StepIcon />}
          incomplete={<StepNumber />}
          active={<StepNumber />}
        />
      </StepIndicator>
    
      <div css={[
        tw`flex-grow ml-4 mb-8 px-8 py-4 rounded-sm bg-gray-700 transition-all`,
        (index === currentStep) ? tw`opacity-100` : tw`opacity-75 hover:opacity-100`
      ]}>
        {children}
      </div>

      {!isEnd ? (
        <StepSeparator />
      ) : null}
    </Step>
  )
}

// Step 2

function UploadCodeButton() {
  const hasCert = useAtomValue(hasCertAtom)
  const { isLoading, upload } = useUploadCode()
  const currentStep = useAtomValue(currentStepAtom)
  return (
    <Button isDisabled={currentStep > 2} isLoading={isLoading} onClick={upload}>
      {!hasCert ? 'Sign Cert and Upload' : 'Upload'}
    </Button>
  )
}

function CodeUploadStep() {
  return (
    <div tw="flex flex-col gap-2">
      <Text>Choice a cluster to upload code</Text>
      <ClusterIdSelect />
      <div>
        <Suspense>
          <UploadCodeButton />
        </Suspense>
      </div>
    </div>
  )
}

// Step 3: Blueprint Promise - instantiate contract.

function ContractId() {
  const blueprintPromise = useAtomValue(blueprintPromiseAtom)
  const toast = useToast()
  if (!blueprintPromise) {
    return null
  }
  const codeHash = blueprintPromise.codeHash.toHex()
  return (
    <FormControl>
      <FormLabel>
        Contract ID
      </FormLabel>
      <div tw="flex flex-row gap-2 items-center">
        <code tw="font-mono text-xs p-1 bg-black rounded">{codeHash}</code>
        <CopyToClipboard
          text={codeHash}
          onCopy={() => toast({
            title: 'Copied',
            status: 'success',
            duration: 2000,
            isClosable: true,
          })}
        >
          <IconButton aria-label='Copy' size="sm">
            <VscCopy tw="h-4 w-4" />
          </IconButton>
        </CopyToClipboard>
      </div>
    </FormControl>
  )
}

const TransferToCluster = () => {
  const hasCert = useAtomValue(hasCertAtom)
  const { isLoading, transfer, refreshBalance } = useClusterBalance()
  const [value, setValue] = useState(new Decimal(0))
  if (!hasCert) {
    return null
  }
  return (
    <div tw="flex flex-row gap-2 items-center">
      <NumberInput
        size="xs"
        onChange={(num) => setValue(new Decimal(num))}
      >
        <NumberInputField />
      </NumberInput>
      <Button
        isDisabled={isLoading}
        colorScheme="phalaDark"
        size="xs"
        onClick={() => transfer(value)}
      >
        Transfer
      </Button> 
      {isLoading ? (<Spinner colorScheme="pbalaDark" size="sm" />) : null } 
      <Button
        size="xs"
        onClick={refreshBalance}
      >
        Refresh
      </Button>
    </div>
  )
}

function InstantiateGasElimiation() {
  const blueprint = useAtomValue(blueprintPromiseAtom)
  const constructor = useAtomValue(selectedContructorAtom)
  const currentAccount = useAtomValue(currentAccountAtom)
  const [, cert] = useAtomValue(cachedCertAtom)
  const signer = useAtomValue(signerAtom)
  const registry = useAtomValue(phatRegistryAtom)
  const finfo = useAtomValue(candidateFileInfoAtom)
  const currentStep = useAtomValue(currentStepAtom)

  const [txOptions, setTxOptions] = useState<any>(null)
  const [minClusterBalance, setMinClusterBalance] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const { currentBalance, refreshBalance, transfer, isLoading: isUpdatingClusterBalance } = useClusterBalance()

  const [inlineChargeVisible, setInlineChargeVisible] = useState(false)

  useEffect(() => {
    if (blueprint && constructor && currentAccount && cert && registry) {
      (async () => {
        setIsLoading(true)
        try {
          setTxOptions(null)
          // @ts-ignore
          const { gasRequired, storageDeposit, salt } = await blueprint.query[constructor](currentAccount.address, { cert }) // Support instantiate arguments.
          const gasLimit = new Decimal(gasRequired.refTime.toNumber()).div(new Decimal(registry.clusterInfo?.gasPrice?.toNumber() || 1)).div(1e12)
          const storageDepositeFee = new Decimal((registry.clusterInfo?.depositPerByte?.toNumber() || 0)).mul(finfo.size * 5).div(1e8)
          setTxOptions({
            gasLimit: gasRequired.refTime,
            storageDepositLimit: storageDeposit.isCharge ? storageDeposit.asCharge : null,
            salt
          })
          setMinClusterBalance(gasLimit.plus(storageDepositeFee).toNumber())
          await refreshBalance()
        } finally {
          setIsLoading(false)
        }
      })();
    }
  }, [blueprint, constructor, currentAccount, cert, registry, refreshBalance, setTxOptions, setMinClusterBalance, setIsLoading])

  const contract = useAtomValue(candidateAtom)
  const saveContract = useSetAtom(localContractsAtom)
  const setInstantiatedContractId = useSetAtom(instantiatedContractIdAtom)

  const instantiate = async () => {
    if (!blueprint || !currentAccount || !constructor || !txOptions) {
      return
    }
    setIsLoading(true)
    try {
      // @ts-ignore
      const { result: instantiateResult }= await signAndSend(
        blueprint.tx[constructor](txOptions),
        currentAccount.address,
        signer
      )
      await instantiateResult.waitFinalized()

      const { contractId } = instantiateResult
      const metadata = R.dissocPath(['source', 'wasm'], contract)
      saveContract(exists => ({ ...exists, [contractId]: {metadata, contractId, savedAt: Date.now()} }))
      setInstantiatedContractId(contractId)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div tw="mt-2 flex flex-col gap-2">
      <table tw="inline-flex">
        <tbody>
          <tr>
            <td tw="pr-2.5 text-right">Minimal Required:</td>
            <td>{isUpdatingClusterBalance ? <Spinner /> : <span tw="text-sm whitespace-nowrap" title={minClusterBalance.toString()}>{minClusterBalance.toFixed(6)} PHA</span>}</td>
          </tr>
          <tr>
            <td tw="pr-2.5 text-right">Cluster Balance:</td>
            <td>
              <span tw="text-sm whitespace-nowrap" title={currentBalance.toString()}>{currentBalance.toFixed(6)} PHA</span>
            </td>
            <td>
              <div tw="ml-2.5 flex flex-row gap-2 items-center">
                {inlineChargeVisible ? (
                  <>
                    <TransferToCluster />
                    <Button size="xs" onClick={() => setInlineChargeVisible(false)}><VscClose /></Button>
                  </>
                ) : (
                  <Button size="xs" onClick={() => setInlineChargeVisible(true)}>Transfer</Button>
                )}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div>
        {(currentBalance < minClusterBalance) ? (
          <Button
            isDisabled={!blueprint || currentStep > 3}
            isLoading={isLoading}
            onClick={async () => {
              await transfer(new Decimal(minClusterBalance))
              await instantiate()
            }}
          >
            Transfer minimal and instantiate
          </Button>
        ) : (
          <Button isDisabled={!blueprint || currentStep > 3} isLoading={isLoading} onClick={instantiate}>Instantiate</Button>
        )}
      </div>
    </div>
  )
}

// Step 4

function InstantiatedFinish() {
  const instantiatedContractId = useAtomValue(instantiatedContractIdAtom)
  const reset = useReset()
  if (!instantiatedContractId) {
    return null
  }
  return (
    <div tw="flex flex-col gap-4">
      <Alert status='success'>
        <AlertIcon />
        <div>
          <p>Contract Uploaded and instantiated successfully. You need staking computation resource to run the contract.</p>
        </div>
      </Alert>
      <ButtonGroup>
        <Link to={`/contracts/view/${instantiatedContractId}`}>
          <Button
            colorScheme="phalaDark"
            onClick={() => reset()}
          >
            Go next
          </Button>
        </Link>
      </ButtonGroup>
    </div>
  )
}

//
// Final Page Composition
//

export default function FatContractUploadForm() {
  const activeStep = useAtomValue(currentStepAtom)
  return (
    <div>
      <Stepper index={activeStep} size='sm' gap='0' orientation='vertical' colorScheme="phalaDark">
        <StepSection index={0}>
          <ContractFileUpload isCheckWASM={true} />
        </StepSection>
        <StepSection index={1}>
          <CodeUploadStep />
        </StepSection>
        <StepSection index={3}>
          <Suspense>
            <ContractId />
          </Suspense>
          <InitSelectorField />
          <Suspense>
            <InstantiateGasElimiation />
          </Suspense>
        </StepSection>
        <StepSection index={4}>
            <Suspense>
              <InstantiatedFinish />
            </Suspense>
        </StepSection>
      </Stepper>
    </div>
  )
}

